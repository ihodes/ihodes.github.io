This is my website generator.

I used to use Hakyll to generate this website, but found myself spending more time fixing Haskell packaging issues than writing. That was fun 10 years ago, but less fun in 2024. It's surprisingly easy to make a nice website generator from scratch and get it publishing via GitHub actions these days, so that's what I did. I don't think the TLOC are likely to be more longer than configuring an existing static site generator (my Hakyll config was nearly as long, and twice as confusing). 


Locally - 
- `poetry run python generator` to generate the site (and `-s` to automatically regenerate and serve)
- Git push to GitHub to use GitHub Actions to update the life site as https://isaachodes.io