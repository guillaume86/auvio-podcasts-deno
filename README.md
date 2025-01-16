# Config

You will  need to provide your auvio email and password which will be used to scrape the full episodes URLs. To provide them, use these environment variables, you can put them in a `.env` file at the root of the repo and they will be loaded:

- `AUVIO_EMAIL` **required**: your auvio email (login identifier)
- `AUVIO_PASSWORD` **required**: your auvio password


# Running on deno

Clone this repo.

and run the project:

> deno task start

The application will be available at http://localhost:3000 by default.

# Running on Docker

Use the compose.yml file as reference. You can also provide a `BASE_URL` environment variable if you want to expose this service to the internet (to use if with your favorite podcasts app...).

# Improvements

- fallback to scraping when failing?
- use a single browser with n tabs to speed up scraping
- /status and /logs routes
- HEAD request to get Content-Length/Content-Type for <enclosure> tag
- push feed periodically to github pages ?