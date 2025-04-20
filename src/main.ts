import { checkAllUrls } from './url-checker';

// 手動実行用
export const manualCheck = (): void => {
  checkAllUrls();
};

// スケジュール設定
export const setupTrigger = (): void => {
  // 既存トリガー削除
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'scheduledCheck')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  // 毎日午前9時に実行
  ScriptApp.newTrigger('scheduledCheck').timeBased().everyHours(1).create();
};

// スケジュール実行用
export const scheduledCheck = (): void => {
  checkAllUrls();
};
