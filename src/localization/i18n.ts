// Localization Coordinator with Persian & English RTL/LTR support
import { en } from './translations/en';
import { fa } from './translations/fa';
import type { SupportedLanguage } from '../types';

export type TranslationKey = keyof typeof en;

export class I18nManager {
  private static currentLang: SupportedLanguage = 'en';

  static getLanguage(): SupportedLanguage {
    return this.currentLang;
  }

  static setLanguage(lang: SupportedLanguage): void {
    this.currentLang = lang;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = this.getDirection();
    }
  }

  static getDirection(): 'ltr' | 'rtl' {
    return this.currentLang === 'fa' ? 'rtl' : 'ltr';
  }

  static t(key: TranslationKey): string {
    const dict = this.currentLang === 'fa' ? fa : en;
    return dict[key] || en[key] || key;
  }
}
