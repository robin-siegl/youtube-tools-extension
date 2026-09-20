import { EXTENSION_PREFIX } from '../constants';

export class OverlayHost {
  private root: HTMLDivElement | null = null;
  private toastTimer: number | null = null;

  getRoot(): HTMLDivElement {
    if (this.root?.isConnected) return this.root;

    const root = document.createElement('div');
    root.id = `${EXTENSION_PREFIX}-overlay-layer`;
    root.className = `${EXTENSION_PREFIX}-overlay-layer`;
    document.body.appendChild(root);
    this.root = root;
    return root;
  }

  append(element: HTMLElement): void {
    this.getRoot().appendChild(element);
  }

  showToast(message: string): void {
    let toast = document.getElementById(`${EXTENSION_PREFIX}-toast`);

    if (!toast) {
      toast = document.createElement('div');
      toast.id = `${EXTENSION_PREFIX}-toast`;
      toast.className = `${EXTENSION_PREFIX}-toast`;
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.remove(`${EXTENSION_PREFIX}-toast--visible`);
    void toast.offsetWidth;
    toast.classList.add(`${EXTENSION_PREFIX}-toast--visible`);

    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      toast?.classList.remove(`${EXTENSION_PREFIX}-toast--visible`);
      this.toastTimer = null;
    }, 2800);
  }

  clear(): void {
    this.root?.remove();
    this.root = null;
  }
}
