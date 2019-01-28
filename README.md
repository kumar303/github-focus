This is a browser extension that gives you desktop notifications for important [GitHub](https://github.com/) activity.

Why? I watch a lot of repositories. This lets me keep up with all pull requests and issues but I don't want instant notifications for all of that activity.
I do want instant notifications but only for specific types of acitivity and I want to pause them while not working. I couldn't find an existing solution for this.

Currently the extension only sends desktop notifications for:

* Review requests
* Mentions
* Assignments
* Comments on pull requests that you're participating in

## Installation

You can install the latest built version into Firefox from the [dist](./dist/xpi/) directory. These builds may be out of date.

Alternatively, you can clone the repository and install the extension [from source into Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Temporary_Installation_in_Firefox).

## Usage

Generate a GitHub [personal access token](https://github.com/settings/tokens/new?scopes=notifications&description=Notifier%20for%20GitHub%20extension) with the `notifications` scope.
This [link](https://github.com/settings/tokens/new?scopes=notifications&description=GitHub%20Focus%20extension) will begin creating one.
Go to `about:addons`, find the add-on, and click Preferences to enter your access token.

You will now begin receiving desktop notifications.

## Development

Make sure you have Firefox, Node.js (8 or higher), and yarn installed. Start developing like this:

```
yarn
yarn start
```

## TODO

* Pause desktop notifications while not working or while trying to do uninterrupted work
* Support Chrome
* Make "important activity" configurable

## Build an alpha release

First, bump the version in `manifest.json` and **make sure the `manifest.json` ID is an alpha ID**. Next, run this:

```
WEB_EXT_API_KEY=jwt_issuer_from_devhub WEB_EXT_API_SECRET=jwt_secret_from_devhub yarn build-alpha
```

Commit the dist file and tag the version. You can now install this XPI file in Firefox.

## Release

Bump the version in `manifest.json` and `package.json`, create a git tag, execute `yarn pkg`, and upload the new version to the Firefox Developer Hub.

## Icons

The icons for this extension are provided by [icons8](https://icons8.com/).
