# Decap CMS Auth Without Netlify
If you want to use the Decap CMS but do not want Netlify then this is the solution for you.  This solution allows you to host the authentication backend for Decamp CMS in your own environment.

I am hosting this on Googles Cloud Run.  Use the quick deploy button to get your own copy of the repository running on your Google Cloud Run instance.  Otherwise you can clone the repository and depoy to your own environment, no matter where that is.

[![Run on Google Cloud](https://deploy.cloud.run/button.svg)](https://deploy.cloud.run)

This will setup everything needed for authenticating to the decamp the CMS:

* A new repository in your GitHub account with the code
* Full Continuous Deployment to Google Cloud Run
* Manage content with Decamp CMS

Once you have deployed this you will need to point your static site to the new endpoint.
```yaml
backend:
  name: github
  branch: master
  repo: '{Your static website repo}' # change this to your repo
  base_url: '{Your new Decap CMS auth endpoint}' # change this to your OAuth server
```
You can now add and edit content by navigating to your.app/admin.

# Running Locally

## Prerequisites
- Docker installed
- GCP SDK installed
- Python 3.7
- WSL (if Windows machine)

1. Clone the repository
2. Run the following docker commands
```bash
docker build -t decap_cms_auth .
docker run --rm -p 8080:8080 -e PORT=8080 decap_cms_auth
```

# Credit
I based a lot of the flow from this blog post: [https://tylergaw.com/blog/netlify-cms-custom-oath-provider/](https://tylergaw.com/blog/netlify-cms-custom-oath-provider/)