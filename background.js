const logId = 'github-focus [extension]';
console.log(`${logId}: starting background script`);

const HTTP_STATUS_RESET = 205;

var accessToken;
var notificationURLs = {};
var readNotifications = {};

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

    // Clear old notifications.
    notificationURLs = {};

    // TODO: add a starting point timestamp ('since')
    const response = await apiRequest('https://api.github.com/notifications');
    const notifications = await response.json();

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

      // Only show desktop notifications for the ones we care about.
      if (
        notification.reason === 'review_requested' ||
        notification.reason === 'mention' ||
        notification.reason === 'comment'
      ) {
        const url = getNotificationURL(notification);
        notificationURLs[notification.id] = url;
        console.log(`${logId}: Showing notification`, notification, url);

        await browser.notifications.create(notification.id, {
          type: 'basic',
          title: notification.subject.title,
          message: notification.repository.full_name,
          eventTime: Date.parse(notification.updated_at),
        });
      }
    });
  } catch (error) {
    console.error(`${logId}: Caught exception: ${error}`);
  }
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
    const url = notificationURLs[notificationId];
    if (url) {
      const tab = await browser.tabs.create({
        url,
      });
      await browser.windows.update(tab.windowId, {
        focused: true,
      });

      await markNotificationAsRead(notificationId);

      // Since I can't quite tell if the PATCH to make a notification
      // read is working or not (maybe caching?), set local data to track
      // it, too.
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
  } catch (error) {
    console.error(`${logId}: Caught exception: ${error}`);
  }
}

start();
