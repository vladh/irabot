# irabot

A Discord bot for listening to podcasts.

The default prefix is `.`. You can get a list of commands by typing `.help`. Here's an excerpt:

* `.help`: Print help.
* `.play <url>`: Play from a certain URL. Supports an Overcast URL, or a direct URL to the audio file.
* `.pause` or `.p`: Pause currently playing audio.
* `.resume` or `.r`: Resume currently playing audio.
* `.stop`: Stop currently playing audio.
* `.seek [500|-10|+20]`: Seek to a certain relative or absolute point in time (in seconds).
* `.status`: Print current status.

I recommend using Overcast URLs — you'll be able to find one for almost all podcasts.

## Usage

* `cp config.example.js config.js`
* Add your token to `config.js`
* `node index.js`
