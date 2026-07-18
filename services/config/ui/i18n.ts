// Messages for the Configuration service. English (US) is the canonical source; German and
// Japanese are translations. Registered on import (see index.tsx).
//
// Only the editor's own chrome is translated here. The settings themselves are named by the
// declaring service's manifest; a service may localize its own labels by registering
// `config.cat.<service>.<category>` / `config.set.<service>.<id>` in its bundle — otherwise the
// manifest text is shown verbatim (same fallback rule as the rights catalog).
import { registerMessages } from '@holistic/ui';

registerMessages({
  'en-US': {
    'service.config': 'Configuration',
    'config.save': 'Save',
    'config.saved': (v) => `${v.service} configuration saved`,
    'config.saveFailed': 'Could not save the configuration',
    'config.loadFailed': 'Could not load the configuration.',
    'config.empty': 'No service declares any configuration.',
    'config.invalidNumber': (v) => `${v.label} must be a whole number`,
    'config.confirmTitle': (v) => `Change ${v.labels}?`,
  },

  de: {
    'service.config': 'Konfiguration',
    'config.save': 'Speichern',
    'config.saved': (v) => `Konfiguration von ${v.service} gespeichert`,
    'config.saveFailed': 'Konfiguration konnte nicht gespeichert werden',
    'config.loadFailed': 'Konfiguration konnte nicht geladen werden.',
    'config.empty': 'Kein Dienst deklariert eine Konfiguration.',
    'config.invalidNumber': (v) => `${v.label} muss eine ganze Zahl sein`,
    'config.confirmTitle': (v) => `${v.labels} ändern?`,
  },

  ja: {
    'service.config': '設定',
    'config.save': '保存',
    'config.saved': (v) => `${v.service} の設定を保存しました`,
    'config.saveFailed': '設定を保存できませんでした',
    'config.loadFailed': '設定を読み込めませんでした。',
    'config.empty': '設定を宣言しているサービスはありません。',
    'config.invalidNumber': (v) => `${v.label} は整数で入力してください`,
    'config.confirmTitle': (v) => `${v.labels} を変更しますか？`,
  },
});
