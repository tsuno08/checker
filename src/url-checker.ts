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
Analyze the content at \`${url}\`. Find the date and time of the absolute latest changelog entry.

Format the result as follows:
- If time is available: \`YYYY-MM-DD HH:MM:SS\`
- If time is NOT available: \`YYYY-MM-DD\`

**Output ONLY the formatted string.** No surrounding text, no explanations.

If no date is found, the output must be exactly: \`No dates detected.\`
`,
              },
            ],
          },
        ],
        tools: [
          {
            google_search: {},
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
Go to the URL: \`${url}\`

Identify the single, **most recent** changelog entry listed on that page. Extract the key information from this entry, including (if available):
* The title or main heading of the entry.
* The primary content or summary describing the change.
* The publication date associated with the entry.

Based **only** on the extracted information from that single most recent entry, **generate a clean and readable HTML block** to display this information clearly ("わかりやすく表示").

* Use appropriate HTML tags for structure and readability (e.g., \`<h2>\`/\`<h3>\` for title, \`<p>\` for content, \`<strong>\` or \`<time>\` for the date).
* Ensure the generated HTML focuses solely on presenting the information from the most recent entry.

**Your response MUST be ONLY the generated HTML block.** Do not include any introductory text, explanations, comments, or any text outside of the main HTML block you generate.

If you cannot find any changelog entries or cannot extract the necessary information to present, your entire output must be exactly this HTML snippet: \`<p>No changelog entries detected.</p>\`
`,
              },
            ],
          },
        ],
        tools: [
          {
            google_search: {},
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
