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

// ハッシュ計算
const calculateHash = (content: string): string => {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    content,
    Utilities.Charset.UTF_8
  );
  return digest.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Gemini APIで解析
const analyzeWithGemini = async (
  oldContent: string,
  newContent: string
): Promise<string> => {
  try {
    const apiKey =
      PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEYが設定されていません');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `以下の差分を日本語で簡潔に要約してください:\n\n### 変更前${oldContent}\n\n### 変更後${newContent}`,
    });
    return response.text || '解析できませんでした';
  } catch (e) {
    console.error('Gemini API解析エラー:', e);
    return `解析エラー: ${(e as Error).message}`;
  }
};

// 変更比較
const compareContent = async (
  url: string,
  newContent: string
): Promise<{ changed: boolean; analysis?: string }> => {
  const props = PropertiesService.getScriptProperties();
  const hashKey = `last_hash_${encodeURIComponent(url)}`;
  const contentKey = `last_content_${encodeURIComponent(url)}`;

  const newHash = calculateHash(newContent);
  const lastHash = props.getProperty(hashKey);
  const lastContent = props.getProperty(contentKey);

  if (lastHash !== newHash) {
    props.setProperty(hashKey, newHash);
    props.setProperty(contentKey, newContent);

    if (lastHash) {
      const analysis = await analyzeWithGemini(lastContent || '', newContent);
      return { changed: true, analysis };
    }
    return { changed: false };
  }
  return { changed: false };
};

// 通知送信
const sendNotification = (
  url: string,
  changes: string,
  analysis: string
): void => {
  const email =
    PropertiesService.getScriptProperties().getProperty('EMAIL_RECIPIENT');
  if (!email) {
    throw new Error('EMAIL_RECIPIENTが設定されていません');
  }
  MailApp.sendEmail({
    to: email,
    subject: `更新検出: ${url}`,
    htmlBody: `
      <h2>更新が検出されました</h2>
      <p><strong>URL:</strong> ${url}</p>
      <h3>変更分析:</h3>
      <p>${analysis.replace(/\n/g, '<br>')}</p>
      <h3>詳細:</h3>
      <div style="white-space: pre-wrap">${changes}</div>
    `,
  });
};

const URLS = [
  'https://windsurf.com/changelog',
  'https://www.cursor.com/ja/changelog',
  'https://github.blog/changelog/label/copilot/',
  'https://github.com/RooVetGit/Roo-Code/releases',
  'https://github.com/cline/cline/releases',
];

export const checkAllUrls = async (): Promise<void> => {
  for (const url of URLS) {
    try {
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const content = response.getContentText();
      const { changed, analysis } = await compareContent(url, content);

      if (changed && analysis) {
        sendNotification(url, content, analysis);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `URLチェック失敗: ${url}. エラー内容: ${error.message}. 解決方法: URLが正しいか、ネットワーク接続を確認してください。`
        );
      } else {
        console.error(`URLチェック失敗: ${url}. 未知のエラーが発生しました。`);
      }
    }
  }
};
