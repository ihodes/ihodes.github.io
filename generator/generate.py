import glob
import os
import re
import shutil
import pathlib
from datetime import datetime

import markdown2

from jinja2 import Environment, FileSystemLoader, select_autoescape



DEST_ROOT_PATH = "./dist/"
POST_PATH = "p"
ABOUT_PATH = "about"
SHELF_PATH = "shelf"
CSS_PATH = "css"
JS_PATH = "js"
IMAGES_PATH = "images"
ASSETS_PATH = "assets"

ENV = Environment(
    loader=FileSystemLoader("templates"),
    autoescape=select_autoescape()
)

TEMPLATES = {
    'post': ENV.get_template('post.html'),
    'index': ENV.get_template('index.html'),
    'about': ENV.get_template('about.html'),
    'shelf': ENV.get_template('shelf.html'),
}


md_extras = ["footnotes", "fenced-code-blocks", "header-ids", "strike", "metadata"]
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
    slug = sluggify(title)
    d = datetime.strptime(post.metadata['date'], '%Y-%m-%d')
    post_data = {
        'title': title,
        'url': os.path.join(POST_PATH, slug),
        'date': post.metadata['date'],
        'formatted_date': d.strftime('%B %d, %Y'),
        'html': post,
        'metadata': post.metadata,
    }
    return post_data


def get_posts(posts_dir="./posts/"):
    """Return all processed posts in the directory."""
    return [process_post(p) for p in glob.glob(posts_dir + '*.md')]

    
def format_post(post, template=TEMPLATES['post']):
    """Given a path to a Markdown post with appropriate metadata, and the path to a template
    format the post appropriately and return the formatted HTML.
    """
    md_html = post['html']
    html_text = template.render(text=md_html,
                                title=post['title'],
                                date=post['date'],
                                formatted_date=post['formatted_date'])
    return html_text


def format_index(template=TEMPLATES['index']):
    posts = get_posts()
    # sort in reverse-chronological order
    posts = sorted(posts, key=lambda p: datetime.strptime(p['date'], '%Y-%m-%d'), reverse=True)
    html_text = template.render(posts=posts)
    return html_text


def format_about(template=TEMPLATES['about']):
    html_text = template.render()
    return html_text


def format_shelf(template=TEMPLATES['shelf']):
    html_text = template.render()
    return html_text



############################################
#   Writing to output directory (./dist)   #
############################################

def clean_dest():
    shutil.rmtree(DEST_ROOT_PATH, ignore_errors=True)


def write_index():
    print("writing index.html")
    index_html = format_index()
    with open(os.path.join(DEST_ROOT_PATH, 'index.html'), 'w') as f:
        f.write(index_html)

def write_about():
    print("writing about page")
    about_html = format_about()
    about_path = os.path.join(DEST_ROOT_PATH, ABOUT_PATH)
    pathlib.Path(about_path).mkdir(parents=True, exist_ok=True)
    with open(os.path.join(about_path, 'index.html'), 'w') as f:
        f.write(about_html)


def write_shelf():
    print("writing shelf page")
    shelf_html = format_shelf()
    shelf_path = os.path.join(DEST_ROOT_PATH, SHELF_PATH)
    pathlib.Path(shelf_path).mkdir(parents=True, exist_ok=True)
    with open(os.path.join(shelf_path, 'index.html'), 'w') as f:
        f.write(shelf_html)


def write_posts():
    dest_post_path = os.path.join(DEST_ROOT_PATH, POST_PATH)
    pathlib.Path(dest_post_path).mkdir(parents=True, exist_ok=True)
    print("---writing posts---")
    posts = get_posts()
    for post in posts:
        print("writing ", post['title'])
        html = format_post(post)
        post_title_slug = sluggify(post['title'])
        post_path = os.path.join(dest_post_path, post_title_slug)
        pathlib.Path(post_path).mkdir(parents=True, exist_ok=True)
        with open(os.path.join(post_path, 'index.html'), 'w') as f:
            f.write(html)
    print("---done with posts---")


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
    write_about()
    write_shelf()
    write_posts()
    write_assets()
    print('___completed___')
    

