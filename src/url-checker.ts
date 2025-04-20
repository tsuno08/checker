// 設定管理
const getConfig = () => {
  const props = PropertiesService.getScriptProperties();
  return {
    email: props.getProperty('EMAIL_RECIPIENT') || 'your-email@example.com',
    spreadsheetId: props.getProperty('SPREADSHEET_ID') || '',
  };
};

// コンテンツ取得
const fetchContent = (url: string): string => {
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  return response.getContentText();
};

// 変更比較
const compareContent = (url: string, newContent: string): boolean => {
  const props = PropertiesService.getScriptProperties();
  const key = `last_content_${encodeURIComponent(url)}`;
  const lastContent = props.getProperty(key);

  if (lastContent !== newContent) {
    props.setProperty(key, newContent);
    return !!lastContent; // 初回はfalse、更新時はtrue
  }
  return false;
};

// 通知送信
const sendNotification = (url: string, changes: string): void => {
  const { email } = getConfig();
  MailApp.sendEmail({
    to: email,
    subject: `更新あり: ${url}`,
    htmlBody: `以下の変更を検出しました:<br><br>${changes}`,
  });
};

// サイトごとのパーサー
const parsers: Record<string, (content: string) => string> = {
  'https://windsurf.com/changelog': content =>
    content.match(/<div class="changelog">([\s\S]*?)<\/div>/)?.[1] || '',

  'https://www.cursor.com/ja/changelog': content => {
    const jaContent =
      content.match(/<div id="ja-content">([\s\S]*?)<\/div>/)?.[1] || content;
    return jaContent.replace(/<[^>]+>/g, '').trim();
  },

  'https://github.blog/changelog/label/copilot/': content =>
    (content.match(/<article[\s\S]*?<\/article>/g) || []).join('\n\n'),

  'https://github.com/RooVetGit/Roo-Code/releases': content =>
    (content.match(/<div class="release[\s\S]*?<\/div>/g) || [])
      .map(release => release.replace(/<[^>]+>/g, '').trim())
      .join('\n\n'),

  'https://github.com/cline/cline/releases': content =>
    (content.match(/<div class="release[\s\S]*?<\/div>/g) || [])
      .map(release => release.replace(/<[^>]+>/g, '').trim())
      .join('\n\n'),
};

// メイン処理
const checkUrl = (url: string): void => {
  try {
    const content = fetchContent(url);
    const parsed = parsers[url]?.(content) || content;
    const hasChanges = compareContent(url, parsed);

    if (hasChanges) {
      sendNotification(url, parsed);
    }
  } catch (error) {
    console.error(`URLチェック失敗: ${url}`, error);
  }
};

// 一括チェック
export const checkAllUrls = (): void => {
  Object.keys(parsers).forEach(checkUrl);
};
