import { useEffect, useState } from 'react';
import type { SectionId } from './catalogue/types';

export type Route =
  | { name: 'catalogue' }
  | { name: 'opportunity'; id: string }
  | { name: 'guide'; id: string; section: SectionId }
  | { name: 'applications' }
  | { name: 'continue'; portal: 'mahadbt' | 'nsp'; id?: string }
  // legacy workflow prototype (demo tools)
  | { name: 'tools' }
  | { name: 'apply' }
  | { name: 'application'; id: string }
  | { name: 'officer' }
  | { name: 'schemes' }
  | { name: 'analytics' };

const SECTIONS: SectionId[] = ['overview', 'eligibility', 'documents', 'form', 'status'];

export function parse(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'opportunity':
      return parts[1] ? { name: 'opportunity', id: parts[1] } : { name: 'catalogue' };
    case 'guide': {
      if (!parts[1]) return { name: 'catalogue' };
      const s = SECTIONS.find((x) => x === parts[2]) ?? 'overview';
      return { name: 'guide', id: parts[1], section: s };
    }
    case 'applications':
      return { name: 'applications' };
    case 'continue':
      return { name: 'continue', portal: parts[1] === 'nsp' ? 'nsp' : 'mahadbt', id: parts[2] };
    case 'tools':
      return { name: 'tools' };
    case 'apply':
      return { name: 'apply' };
    case 'application':
      return parts[1] ? { name: 'application', id: parts[1] } : { name: 'tools' };
    case 'officer':
      return { name: 'officer' };
    case 'schemes':
      return { name: 'schemes' };
    case 'analytics':
      return { name: 'analytics' };
    default:
      return { name: 'catalogue' };
  }
}

export function useRoute(): Route {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parse(hash);
}

export const go = (path: string) => {
  window.location.hash = path;
};
