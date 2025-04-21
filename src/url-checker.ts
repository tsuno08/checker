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
import { GoogleGenAI } from '@google/genai';

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

// Gemini APIで解析
export const analyzeWithGemini = async (
  newContent: string
): Promise<string> => {
  try {
    const apiKey =
      PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEYが設定されていません');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `以下から新しい情報を取得してください:\n\n${newContent}`,
    });
    return response.text || '解析できませんでした';
  } catch (e) {
    console.error('Gemini API解析エラー:', e);
    return `解析エラー: ${(e as Error).message}`;
  }
};

// 変更比較
export const compareContent = async (
  name: string,
  url: string,
  newContent: string
): Promise<{ changed: boolean; analysis?: string }> => {
  const props = PropertiesService.getScriptProperties();
  const hashKey = `last_hash_${name}`;

  const newHash = calculateHash(newContent);
  const lastHash = props.getProperty(hashKey);

  if (lastHash !== newHash) {
    props.setProperty(hashKey, newHash);

    if (lastHash) {
      const analysis = await analyzeWithGemini(newContent);
      return { changed: true, analysis };
    }
    return { changed: false };
  }
  return { changed: false };
};

// 通知送信
export const sendNotification = (
  name: string,
  url: string,
  analysis: string
): void => {
  const email =
    PropertiesService.getScriptProperties().getProperty('EMAIL_RECIPIENT');
  if (!email) {
    throw new Error('EMAIL_RECIPIENTが設定されていません');
  }
  MailApp.sendEmail({
    to: email,
    subject: `更新検出: ${name}`,
    htmlBody: `
      <h2>更新が検出されました</h2>
      <p><strong>URL:</strong> ${url}</p>
      <h3>変更分析:</h3>
      <p>${analysis.replace(/\n/g, '<br>')}</p>
      <h3>詳細:</h3>
    `,
  });
};

export const checkAllUrls = async (): Promise<void> => {
  for (const service of SERVICES) {
    const url = service.url;
    const name = service.name;
    try {
      const response = UrlFetchApp.fetch(url);
      const content = response.getContentText();
      const { changed, analysis } = await compareContent(name, url, content);

      if (changed && analysis) {
        sendNotification(name, url, analysis);
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
};
