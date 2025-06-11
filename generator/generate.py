import glob
import os
import re
import shutil
import pathlib
from datetime import datetime, timezone
from urllib.parse import urljoin

import markdown2

from jinja2 import Environment, FileSystemLoader, select_autoescape
from feedgen.feed import FeedGenerator

DEST_ROOT_PATH = "./dist/"
POST_PATH = "p"
CSS_PATH = "css"
JS_PATH = "js"
IMAGES_PATH = "images"
ASSETS_PATH = "assets"

ENV = Environment(
    loader=FileSystemLoader("templates"),
    autoescape=select_autoescape()
)

PAGES = {
    'about': (ENV.get_template('about.html'), "about"),
    'shelf': (ENV.get_template('shelf.html'), "shelf"),
    'recipes': (ENV.get_template('recipes.html'), "recipes"),
    'nec': (ENV.get_template('nec.html'), "nec"),
    'sliderule': (ENV.get_template('sliderule.html'), "sliderule")
}

TEMPLATES = {
    'index': ENV.get_template('index.html'),
    'post': ENV.get_template('post.html'),
}

md_extras = ["footnotes", "fenced-code-blocks", "header-ids", "strike", "metadata", "latex"]
M = markdown2.Markdown(extras=md_extras)


def sluggify(title):
    slug = title.lower()
    slug = re.sub(r'\s', '-', slug)
    slug = re.sub(r'[^A-Za-z0-9-]', '', slug)
    return slug


def markdown_post(post_path):
    """Return the markdownified post, with metadata under .metadata"""
    with open(post_path) as f:
        markdown_text = f.read()
    md_html = M.convert(markdown_text)
    return md_html


def process_post(post_path):
    post = markdown_post(post_path)
    title = post.metadata['title']

    publish = True
    publish_val = post.metadata.get('publish')
    if publish_val is not None:
        publish = False if publish_val.lower().strip() == 'false' else True
    slug = sluggify(title)
    d = datetime.strptime(post.metadata['date'], '%Y-%m-%d')
    post_data = {
        'title': title,
        'publish': publish,
        'url': os.path.join(POST_PATH, slug),
        'date': post.metadata['date'],
        'formatted_date': d.strftime('%B %d, %Y'),
        'html': post,
        'metadata': post.metadata,
    }
    return post_data


def get_posts(posts_dir="./posts/", include_unpublished=False):
    """Return all processed posts in the directory."""
    posts = [process_post(p) for p in glob.glob(posts_dir + '*.md')]
    if include_unpublished:
        return posts
    else:
        return [p for p in posts if p['publish']]


def format_post(post, template=TEMPLATES['post']):
    """Format the post appropriately and return the formatted HTML."""
    md_html = post['html']
    html_text = template.render(text=md_html,
                                title=post['title'],
                                date=post['date'],
                                formatted_date=post['formatted_date'])
    return html_text


def format_index(template=TEMPLATES['index']):
    posts = get_posts()
    posts = sorted(posts, key=lambda p: datetime.strptime(p['date'], '%Y-%m-%d'), reverse=True)
    html_text = template.render(posts=posts)
    return html_text


def write_static_page(page_name):
    template, path = PAGES[page_name]
    html_text = template.render()
    path = os.path.join(DEST_ROOT_PATH, path)
    pathlib.Path(path).mkdir(parents=True, exist_ok=True)
    with open(os.path.join(path, 'index.html'), 'w') as f:
        f.write(html_text)



############################################
#   Writing output to DEST_ROOT_PATH       #
############################################

def clean_dest():
    shutil.rmtree(DEST_ROOT_PATH, ignore_errors=True)


def write_index():
    print("writing index.html")
    index_html = format_index()
    with open(os.path.join(DEST_ROOT_PATH, 'index.html'), 'w') as f:
        f.write(index_html)


def write_all_pages():
    for page_name in PAGES:
        print("writing {} page".format(page_name))
        write_static_page(page_name)


def write_posts():
    dest_post_path = os.path.join(DEST_ROOT_PATH, POST_PATH)
    pathlib.Path(dest_post_path).mkdir(parents=True, exist_ok=True)
    print("---writing posts---")
    posts = get_posts(include_unpublished=True)
    for post in posts:
        if post['publish'] == False:
            print(f"skipping post '{post['title']}'")
            continue

        print("writing ", post['title'])
        html = format_post(post)
        post_title_slug = sluggify(post['title'])
        post_path = os.path.join(dest_post_path, post_title_slug)
        pathlib.Path(post_path).mkdir(parents=True, exist_ok=True)
        with open(os.path.join(post_path, 'index.html'), 'w') as f:
            f.write(html)
    print("---done with posts---")


def write_sitemap(base_url):
    print("writing sitemap")
    template = ENV.get_template('sitemap.xml')
    sitemap = template.render(base_url=base_url, posts=get_posts())

    with open(os.path.join(DEST_ROOT_PATH, 'sitemap.xml'), 'w') as f:
        f.write(sitemap)


def write_rss(base_url):
    print("writing RSS feed")
    fg = FeedGenerator()
    fg.title('Notes by Isaac')
    fg.author({'name': 'Isaac Hodes', 'email': 'isaachodes@gmail.com'})
    fg.link(href=base_url, rel='alternate')
    fg.link(href=f'{base_url}/rss.xml', rel='self')
    fg.language('en')
    fg.description('Notes by Isaac')
    fg.logo(f'{base_url}/images/favicons/android-chrome-192x192.png')

    posts = sorted(get_posts(), key=lambda p: datetime.strptime(p['date'], '%Y-%m-%d'), reverse=True)
    for post in posts:
        fe = fg.add_entry()
        fe.title(post['title'])
        fe.link(href=f"{base_url}/{post['url']}/")
        fe.published(datetime.strptime(post['date'], '%Y-%m-%d').replace(tzinfo=timezone.utc))

        # Convert relative URLs to absolute URLs in content, required in RSS 2.0 spec
        html_content = post['html']
        html_content = re.sub(r'(src|href)="(/[^"]*)"',
                             lambda m: f'{m.group(1)}="{urljoin(base_url, m.group(2))}"',
                             html_content)

        fe.content(html_content, type='html')
        if 'summary' in post['metadata']:
            fe.description(post['metadata']['summary'])

    fg.rss_file(os.path.join(DEST_ROOT_PATH, 'rss.xml'))


def write_assets():
    print('copying images to {}'.format(DEST_ROOT_PATH))
    shutil.copytree(IMAGES_PATH, os.path.join(DEST_ROOT_PATH, IMAGES_PATH))
    print('copying css to {}'.format(DEST_ROOT_PATH))
    shutil.copytree(CSS_PATH, os.path.join(DEST_ROOT_PATH, CSS_PATH))
    print('copying js to {}'.format(DEST_ROOT_PATH))
    shutil.copytree(JS_PATH, os.path.join(DEST_ROOT_PATH, JS_PATH))


def write_website(base_url):
    print('writing to "{base}"'.format(base=base_url))
    print('-cleaning dest dir {} -'.format(DEST_ROOT_PATH))
    clean_dest()
    print('___starting website generation___')
    pathlib.Path(DEST_ROOT_PATH).mkdir(parents=True, exist_ok=True)
    write_index()
    write_all_pages()
    write_posts()
    write_rss(base_url)
    write_sitemap(base_url)
    write_assets()
    print('___completed___')
