TODO: rewrite readme for deno version

# Config

You will need a podcasts.txt file with a newline separated list of auvio podcasts URLs.
Here's an example for "La semaine des 5 heures":

```podcasts.txt
https://feeds.audiomeans.fr/feed/d9f1bfe7-dcb7-41e4-90b2-fe41d556b3be.xml

```

To find the URL of a podcast, you can search it on [apple podcasts](https://www.apple.com/be-fr/search/la-semaine-des-5-heures?src=globalnav) and then copy paste the apple podcast URL into [Apple Podcast RSS Feed](https://www.labnol.org/podcast/) to find out the original RSS feed URL.

You will also need to provide your auvio email and password which will be used to scrape the full episodes URLs. To provide them, use these environment variables, you can put them in a `.env` file at the root of the repo and they will be loaded:

- `AUVIO_EMAIL` **required**: your auvio email (login identifier)
- `AUVIO_PASSWORD` **required**: your auvio password


# Running on Node

Clone this repo, create a `.data/` dir at the root of the repo and put your podcasts.txt file into it.

Then install the dependencies: 

> npm install

and run the project:

> npm start

The application will be available at http://localhost:3000 by default.

# Running on Docker

Use the compose.yml file as reference. You can also provide a `BASE_URL` environment variable if you want to expose this service to the internet (to use if with your favorite podcasts app...).

# Improvements

- build in docker
- use APIs to get media urls and fallback to scraping when failing
- use a single browser with n tabs to speed up scraping
- /status and /logs routes
- HEAD request to get Content-Length/Content-Type for <enclosure> tag
- push feed periodically to github pages ?
- move to deno (need puppeteer fix)