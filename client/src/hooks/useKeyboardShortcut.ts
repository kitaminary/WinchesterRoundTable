import { useEffect, useCallback, useRef } from 'react';

export function useKeyboardShortcut(
  key: string | readonly string[],
  callback: () => void,
  options: {
    enabled?: boolean;
    ignoreInputs?: boolean;
    /**
     * Скан-код физической клавиши (`event.code`), не зависит от языка.
     * Например `KeyV` — та же позиция, что даёт «v» в EN и «м» в RU.
     */
    physicalCodes?: readonly string[];
  } = {}
): void {
  const { enabled = true, ignoreInputs = true, physicalCodes } = options;

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const physicalCodesRef = useRef<string[]>(
    physicalCodes != null ? [...physicalCodes] : []
  );
  physicalCodesRef.current =
    physicalCodes != null ? [...physicalCodes] : [];

  const keysRef = useRef<string[]>(
    typeof key === 'string' ? [key] : [...key]
  );
  keysRef.current = typeof key === 'string' ? [key] : [...key];

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const codes = physicalCodesRef.current;
      if (codes.length > 0) {
        if (!codes.includes(event.code)) return;
      } else {
        const list = keysRef.current;
        const lowered = event.key.toLowerCase();
        if (
          list.length > 0 &&
          !list.some((k) => k.toLowerCase() === lowered)
        ) {
          return;
        }
      }

      if (ignoreInputs) {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        const tagName = target.tagName.toLowerCase();
        const isEditable =
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target.isContentEditable ||
          !!target.closest('input, textarea, select, [contenteditable="true"]');

        if (isEditable) return;
      }

      event.preventDefault();
      callbackRef.current();
    },
    [enabled, ignoreInputs]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
