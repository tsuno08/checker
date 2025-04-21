/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const SERVICES = [
  { name: 'windsurf', url: 'https://windsurf.com/changelog' },
  { name: 'cursor', url: 'https://www.cursor.com/ja/changelog' },
  {
    name: 'GitHub Copilot',
    url: 'https://github.blog/changelog/label/copilot/',
  },
  { name: 'Roo Code', url: 'https://github.com/RooVetGit/Roo-Code/releases' },
  { name: 'Cline', url: 'https://github.com/cline/cline/releases' },
];

// ハッシュ計算
export const calculateHash = (content: string): string => {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    content,
    Utilities.Charset.UTF_8
  );
  return digest.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const extractUpdateDate = async (url: string): Promise<string> => {
  try {
    const apiKey =
      PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEYが設定されていません');
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = UrlFetchApp.fetch(apiUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `
      Extract only the most recent date and time from the changelog entries at the following URL:${url}

      Provide the output in a clean, machine-readable format (e.g., \`YYYY-MM-DD HH:MM:SS\` or ISO 8601). Exclude all other text, labels, or metadata. If no timestamps are found, return "No dates detected."`,
              },
            ],
          },
        ],
      }),
    });
    const json = JSON.parse(res.getContentText());
    return json.candidates[0].content.parts[0].text || '解析できませんでした';
  } catch (e) {
    console.error('Gemini API解析エラー:', e);
    return `解析エラー: ${(e as Error).message}`;
  }
};

export const extractUpdateContent = async (url: string): Promise<string> => {
  try {
    const apiKey =
      PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEYが設定されていません');
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = UrlFetchApp.fetch(apiUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `
      Extract the most recent changelog entry from the following URL: ${url}
      Provide the output in a clean, machine-readable format. Exclude all other text, labels, or metadata. If no changelog entries are found, return "No changelog entries detected."`,
              },
            ],
          },
        ],
      }),
    });
    const json = JSON.parse(res.getContentText());
    return json.candidates[0].content.parts[0].text || '解析できませんでした';
  } catch (e) {
    console.error('Gemini API解析エラー:', e);
    return `解析エラー: ${(e as Error).message}`;
  }
};

// 変更比較
export const checkChanged = async (
  name: string,
  url: string
): Promise<boolean> => {
  const props = PropertiesService.getScriptProperties();
  const key = `last_date_${name}`;

  const lastDate = props.getProperty(key);
  const newDate = await extractUpdateDate(url);

  if (lastDate !== newDate) {
    props.setProperty(key, newDate);

    if (lastDate) {
      return true;
    }
    return false;
  }
  return false;
};

// 通知送信
export const sendNotification = async (
  changedServices: {
    name: string;
    url: string;
}[]
): Promise<void> => {
  const email =
    PropertiesService.getScriptProperties().getProperty('EMAIL_RECIPIENT');
  if (!email) {
    throw new Error('EMAIL_RECIPIENTが設定されていません');
  }
  let htmlBody = '';
  for (const service of changedServices) {
    const url = service.url;
    const content = await extractUpdateContent(url);
    htmlBody += `<h3>${service.name}</h3><p>${content}</p>`;
  }
  MailApp.sendEmail({
    to: email,
    subject: `更新検出: ${changedServices.map(service => service.name).join(', ')}`,
    htmlBody,
  });
};

export const checkAllUrls = async (): Promise<void> => {
  const changedServices = [];
  for (const service of SERVICES) {
    const url = service.url;
    const name = service.name;
    try {
      const changed = await checkChanged(name, url);
      if (changed) {
        changedServices.push(service);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `チェック失敗: ${name}. エラー内容: ${error.message}. 解決方法: URLが正しいか、ネットワーク接続を確認してください。`
        );
      } else {
        console.error(`チェック失敗: ${name}. 未知のエラーが発生しました。`);
      }
    }
  }
  await sendNotification(changedServices);
};
