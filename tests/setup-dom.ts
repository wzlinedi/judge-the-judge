// jsdom has no showModal/close on <dialog>; this adds what the components use.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/preact';

const proto = globalThis.HTMLDialogElement?.prototype;
if (proto && typeof proto.showModal !== 'function') {
  proto.show = function show(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement, returnValue?: string) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event('close'));
  };
}

afterEach(() => cleanup());
