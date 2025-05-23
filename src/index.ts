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
import { checkAllUrls } from './url-checker';

// 手動実行用
const manualCheck = async (): Promise<void> => {
  await checkAllUrls();
};

// スケジュール設定
const setupTrigger = (): void => {
  // 既存トリガー削除
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'scheduledCheck')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  // 毎日午前9時に実行
  ScriptApp.newTrigger('scheduledCheck')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
};

// スケジュール実行用
const scheduledCheck = async (): Promise<void> => {
  await checkAllUrls();
};
