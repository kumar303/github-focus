const logId = 'github-focus [extension]';
console.log(`${logId}: starting background script`);

const HTTP_STATUS_RESET = 205;

var accessToken;
// TODO: maybe prevent these mappings from growing in size for eternity?
// We currently cannot clear them in checkNotifications() because an older,
// unread notice might still be visible and that needs to be clickable.
const notificationURLs = {};
const readNotifications = {};

async function getAccessToken() {
  if (!accessToken) {
    await browser.notifications.create({
      type: 'basic',
      title: 'GitHub Focus extension is not configured',
      message: 'Go to about:addons to configure GitHub Focus',
    });
    throw new Error(
      'GitHub personal access token has not been set. Set it in about:addons.',
    );
  }
  return accessToken;
}

async function apiRequest(url, requestOptions, callOptions) {
  const options = requestOptions || {};
  options.method = options.method || 'GET';

  options.headers = options.headers || {};
  options.headers.Accept = 'application/vnd.github.v3+json';
  options.headers.Authorization = `token ${await getAccessToken()}`;

  const requireStatus = callOptions && callOptions.requireStatus;

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${logId}: ${url}; status: ${response.status}`);
  }
  if (requireStatus && response.status !== requireStatus) {
    throw new Error(
      `${logId}: ${url}; received unexpected status: ${response.status}`,
    );
  }

  return response;
}

async function checkNotifications() {
  try {
    console.log(`${logId}: Checking notifications`);

    // TODO: add a starting point timestamp ('since')
    const response = await apiRequest(
      'https://api.github.com/notifications?participating=true',
    );
    const notifications = await response.json();
    let zeroNotifications = true;

    // TODO: pagination, maybe
    notifications.forEach(async (notification) => {
      if (!notification.unread) {
        return;
      }
      if (readNotifications[notification.id]) {
        console.log(
          `${logId}: Relying on LOCAL cache for unread state of notification ${
            notification.id
          }`,
        );
        return;
      }
      if (notificationURLs[notification.id]) {
        console.log(
          `${logId}: notification ${notification.id} has already been shown`,
        );
        return;
      }

      // Only show desktop notifications for the ones we care about.
      if (
        notification.reason === 'assign' ||
        notification.reason === 'comment' ||
        notification.reason === 'mention' ||
        notification.reason === 'review_requested'
      ) {
        if (
          notification.reason === 'comment' &&
          notification.subject.type !== 'PullRequest'
        ) {
          console.log(
            `${logId}: Ignoring comment for subject type ${
              notification.subject.type
            }`,
          );
          return;
        }

        // TODO: Check the PR assignee for review_requested and skip
        // ones not assigned to me. This would also require tracking
        // GitHub user names.

        if (
          notification.subject.type === 'PullRequest' &&
          !(await isOpenPR(notification))
        ) {
          console.log(
            `${logId}: Ignoring non-open PR for notification ${
              notification.id
            }`,
          );
          return;
        }

        zeroNotifications = false;
        const url = getNotificationURL(notification);
        notificationURLs[notification.id] = url;

        console.log(`${logId}: Showing notification`, notification, url);
        await browser.notifications.create(notification.id, {
          type: 'basic',
          title: notification.subject.title,
          message: notification.repository.full_name,
          eventTime: Date.parse(notification.updated_at),
        });
      } else {
        console.log(`${logId} Ignoring notification`, notification);
      }
    });

    if (zeroNotifications) {
      console.log(`${logId}: No important notifications to show`);
    }
  } catch (error) {
    console.error(`${logId}: Caught exception: ${error}`);
  }
}

async function isOpenPR(notification) {
  const number = getIdFromApiUrl(notification.subject.url);
  let response;
  try {
    response = await apiRequest(
      `${notification.repository.url}/pulls/${number}`,
    );
  } catch (error) {
    // The response above might be a 404 if the repo is private.
    console.warn(
      `${logId}: Assuming PR ${number} is open because of error: ${error}`,
    );
    return true;
  }
  const pr = await response.json();

  const isOpen = pr.state === 'open';
  return isOpen;
}

function getIdFromApiUrl(apiUrl) {
  // Get the ID number from an API URL,
  // like https://api.github.com/repos/mozilla/addons-code-manager/pulls/28.
  const match = apiUrl.match(/\/([0-9]+)$/);
  if (!match) {
    throw new Error(`${logId}: Could not find ID in API URL '${apiUrl}'`);
  }
  return match[1];
}

function getNotificationURL(notification) {
  if (notification.subject.type === 'RepositoryInvitation') {
    return `${notification.repository.html_url}/invitations`;
  } else if (notification.subject.type === 'RepositoryVulnerabilityAlert') {
    return `${notification.repository.html_url}/network/dependencies`;
  }

  if (
    notification.subject.type === 'Issue' ||
    notification.subject.type === 'PullRequest'
  ) {
    const number = getIdFromApiUrl(notification.subject.url);
    return `${notification.repository.html_url}/issues/${number}`;
  } else if ('repository' in notification.subject) {
    return notification.subject.repository.html_url;
  }

  console.error(
    `${logId}: Not sure how to get URL for notification.subject.type ${
      notification.subject.type
    }`,
    notification,
  );
}

async function markNotificationAsRead(id) {
  const now = new Date();

  await apiRequest(
    `https://api.github.com/notifications/threads/${id}`,
    {
      // I can't tell if this is necessary or not. The API docs say it's
      // not but I think heavy caching makes notifications appear unread
      // for a long time.
      body: JSON.stringify({ last_read_at: now.toISOString() }),
      method: 'PATCH',
    },
    {
      requireStatus: HTTP_STATUS_RESET,
    },
  );
  console.log(`${logId}: Successfully marked notification ${id} as read`);
}

async function handleNotificationClick(notificationId) {
  try {
    const cleared = await browser.notifications.clear(notificationId);
    if (!cleared) {
      console.warn(
        `${logId}: browser.notifications.clear(${notificationId}) returned false`,
      );
    }

    const url = notificationURLs[notificationId];
    if (url) {
      const tab = await browser.tabs.create({ url });
      await browser.windows.update(tab.windowId, { focused: true });

      await markNotificationAsRead(notificationId);

      // Since I can't quite tell if the API PATCH to make a notification
      // read is working or not (I think it's just heavily cached), set
      // local data to track it, too.
      readNotifications[notificationId] = true;
    } else {
      console.warn(`${logId}: No URL for notification ID ${notificationId}`);
    }
  } catch (error) {
    console.error(`${logId}: Caught exception: ${error}`);
  }
}

async function start() {
  try {
    const pref = await browser.storage.local.get();
    accessToken = pref.option;

    browser.notifications.onClicked.addListener(handleNotificationClick);

    // Check every 10 minutes:
    const interval = 60 * 1000 * 10;
    setInterval(checkNotifications, interval);

    // Kick off the first call:
    checkNotifications();

    browser.browserAction.onClicked.addListener(checkNotifications);
  } catch (error) {
    console.error(`${logId}: Caught exception: ${error}`);
  }
}

start();
