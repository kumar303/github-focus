You will need to generate a GitHub [personal access token](https://github.com/settings/tokens/new?scopes=notifications&description=Notifier%20for%20GitHub%20extension) with the `notifications` scope.
This [link](https://github.com/settings/tokens/new?scopes=notifications&description=GitHub%20Focus%20extension) will begin creating one.


## Development

Make sure you have Firefox, Node.js (8 or higher), and yarn installed. Start developing like this:

```
yarn
yarn start
```

## Release

Bump the version in `manifest.json` and `package.json`, create a git tag, execute `yarn pkg`, and upload the new version to the Firefox Developer Hub.

## Icons

The icons for this extension are provided by [icons8](https://icons8.com/).
