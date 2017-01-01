# About

* Raspberry Pi as a digital photoframe
* Console app
* Uses Linux framebuffer
* Node.js app that retrives images from flickr
* Turns off display if no motion is detected

Note

* Raspbian has (had) a bug that does not properly setup the
  GPIO virtual devices so that they can be accessed via
  non-root. Fix this via https://github.com/raspberrypi/linux/issues/1117

# Requirements

* fim must be installed (`sudo apt-get install fim`)
* node.js must be installed (`sudo apt-get install node`)
* forever (node.js module) must be installed globally (`sudo npm install -g --unsafe-perm forever`)

# Flickr Setup and Authentication Keys

* You need an API key first: https://www.flickr.com/services/api/misc.api_keys.html
* in the `app` folder create a file called `flickr_auth.json` and put the following in it

```json
{
  "api_key": "",
  "secret": "",
  "user_id": "",
  "access_token": "",
  "access_token_secret": ""
}
```

* `api_key` and `secret` are obtained from https://www.flickr.com/services/api/misc.api_keys.html
* Your can find your `user_id` at http://idgettr.com/
* As a Flickr user, you must allow your app to access your account
* `access_token` and `access_token_secret` are obtained when you allow the app to access
  your flickr account
* Do not share these online
* Alternatively, open `app2.js` and replace 

```javascript
var flickrOptions = require('./flickr_auth.json');
```

with

```javascript
var flickrOptions = {
    api_key: process.env.FLICKR_API_KEY,
    secret: process.env.FLICKR_API_SECRET,
    user_id: process.env.FLICKR_USER_ID,
    access_token: process.env.FLICKR_ACCESS_TOKEN,
    access_token_secret: process.env.FLICKR_ACCESS_TOKEN_SECRET
};
```

and define the environment variables in your `.bashrc` file

```bashrc
export FLICKR_API_KEY=""
export FLICKR_API_KEY_SECRET=""
export FLICKR_USER_ID=""
export FLICKR_ACCESS_TOKEN=""
export FLICKR_ACCESS_TOKEN_SECRET=""
```

Initially you will not have the `ACCESS_TOKEN` and `ACCESS_TOKEN_SECRET`. Leave these empty
and run the application directly via `node bin/www`. You will be given an `oauth_token`
followed by prompt to enter the `oauth_verifier`

Go to https://www.flickr.com/services/oauth/authorize?oauth_token=OAUTH_TOKEN&perms=read after
replacing `OAUTH_TOKEN` with the displayed token.

After you have authorized your app to access your account, Flickr will display a
9 digit number. Enter these at the prompt including the hyphens. 

At the prompt you will be shown the `FLICKR_ACCESS_TOKEN` and `FLICKR_ACCESS_TOKEN_SECRET`
that will be needed to be put in the `.bashrc` file.


# Auto Start

* Disable X-server using raspi-config (Enable Boot to ... Console Text console, requiring login (default))
* Open `/etc/inittab` and modify the line below and add `--autologin pi` to it. For example

`1:2345:respawn:/sbin/getty --noclear 38400 tty1`

becomes

`1:2345:respawn:/sbin/getty --noclear --autologin pi 38400 tty1`

* Add the absolute path to `appstart.sh` to your `.bashrc` file. 
* `appstart.sh` starts the application only on `/dev/tty1` and does not impact other consoles
  remote shells.

# Motion Sensor

* Any Passive IR (PIR) motion sensor will do
* `tvservice` is used to find the status of the monitor on HDMI as well as toggle it on and off.
* Make sure the following commands toggle the display

Turn display off

```bash
tvservice -o
```

Turn display on

```bash
tvservice -p;fbset -depth 8; fbset -depth 16
```

I found the type of HDMI cable makes a difference in functionality.
