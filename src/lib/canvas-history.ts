export class CanvasHistory {
  private stack: object[] = [];
  private index = -1;
  private isRestoring = false;

  reset(initial: object) {
    this.stack = [initial];
    this.index = 0;
  }

  push(state: object) {
    if (this.isRestoring) return;
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(state);
    this.index = this.stack.length - 1;
    if (this.stack.length > 50) {
      this.stack.shift();
      this.index--;
    }
  }

  undo(): object | null {
    if (!this.canUndo) return null;
    this.index--;
    return this.stack[this.index];
  }

  redo(): object | null {
    if (!this.canRedo) return null;
    this.index++;
    return this.stack[this.index];
  }

  get canUndo() {
    return this.index > 0;
  }

  get canRedo() {
    return this.index < this.stack.length - 1;
  }

  async runRestore(fn: () => void | Promise<void>) {
    this.isRestoring = true;
    try {
      await fn();
    } finally {
      this.isRestoring = false;
    }
  }
}
