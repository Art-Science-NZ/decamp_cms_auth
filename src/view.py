from flask import Flask, render_template, request, redirect
import os
import requests as r
import json

app = Flask(__name__)

client_id = os.environ.get("OAUTH_CLIENT_ID")
client_secret = os.environ.get("OAUTH_CLIENT_SECRET")
access_origin = os.environ.get("ORIGIN_HEADER")
auth_url = f'https://github.com/login/oauth/authorize?client_id={client_id}&scope=repo,user'
token_url = "https://github.com/login/oauth/access_token"

# NetlifyCMS doesn't use this root page. It's only for dev purposes
@app.route('/')
def home():
    if request.method == 'OPTIONS':
        # Allows GET requests from any origin with the Content-Type
        # header and caches preflight response for an 3600s
        headers = {
            'Access-Control-Allow-Origin': f'"{access_origin}"',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        print("no data uploaded")

        return ('', 204, headers)
    elif request.method == "GET":
        headers = {
            'Access-Control-Allow-Origin': f'"{access_origin}"'
        }       
        return render_template('index.html', value={"auth_url": auth_url})
    else:
        return ("Invalid Method", 400) 

# NetlifyCMS expects to land on a page at /auth.
@app.route("/auth")
def auth():
    if request.method == 'OPTIONS':
        # Allows GET requests from any origin with the Content-Type
        # header and caches preflight response for an 3600s
        headers = {
            'Access-Control-Allow-Origin': f'"{access_origin}"',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        print("no data uploaded")

        return ('', 204, headers)
    elif request.method == "GET":
        headers = {
            'Access-Control-Allow-Origin': f'"{access_origin}"'
        }       
        return redirect(auth_url) 
    else:
        return ("Invalid Method", 400)     
    
# Callback function
@app.route("/callback")
def callback():
    if request.method == 'OPTIONS':
        # Allows GET requests from any origin with the Content-Type
        # header and caches preflight response for an 3600s
        headers = {
            'Access-Control-Allow-Origin': f'"{access_origin}"',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        print("no data uploaded")

        return ('', 204, headers)
    elif request.method == "GET":
        headers = {
            'Access-Control-Allow-Origin': f'"{access_origin}"'
        }       
        args = request.args
        data = {
            "code": args.get("code"),
            "client_id": client_id,
            "client_secret": client_secret
        }
        # resp = r.post(url=token_url, param=data, headers={"Accept": "application/json"}).json()
        try:
            resp = r.post(url=token_url, params=data, headers={"Accept": "application/json"}).json()
            print(resp)
            if "access_token" in resp:
                postMsgContent = {
                    "token": resp["access_token"],
                    "provider": "github"
                }
                postMsgContent = json.dumps(postMsgContent, separators=(',', ':'))
                return render_template("auth.html", value=postMsgContent)
            else:
                Exception("No Access Token")
        except:
            return render_template('error.html' ,value=postMsgContent) 
    else:
        return ("Invalid Method", 400)    
if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)