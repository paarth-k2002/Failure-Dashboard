/**
 * Scroll Sync Service
 * Manages synchronized scrolling between two panels
 */

export type ScrollMode = 'sync' | 'independent' | 'unified';

export interface ScrollState {
  mode: ScrollMode;
  leftScrollPosition: number;
  rightScrollPosition: number;
  isDragging: boolean;
}

class ScrollSyncService {
  private state: ScrollState = {
    mode: 'sync',
    leftScrollPosition: 0,
    rightScrollPosition: 0,
    isDragging: false,
  };

  /**
   * Set the current scroll mode
   */
  setMode(mode: ScrollMode): void {
    this.state.mode = mode;
  }

  /**
   * Get current scroll mode
   */
  getMode(): ScrollMode {
    return this.state.mode;
  }

  /**
   * Handle scroll event on left panel
   * If in sync mode, update right panel to match
   */
  handleLeftScroll(
    leftElement: HTMLElement | null,
    rightElement: HTMLElement | null,
    scrollPosition: number
  ): void {
    if (!leftElement || !rightElement) return;

    this.state.leftScrollPosition = scrollPosition;

    if (this.state.mode === 'sync') {
      // Calculate ratio based on scrollable heights
      const leftScrollHeight = leftElement.scrollHeight - leftElement.clientHeight;
      const rightScrollHeight = rightElement.scrollHeight - rightElement.clientHeight;

      if (leftScrollHeight > 0 && rightScrollHeight > 0) {
        const ratio = rightScrollHeight / leftScrollHeight;
        rightElement.scrollTop = scrollPosition * ratio;
        this.state.rightScrollPosition = scrollPosition * ratio;
      }
    }
  }

  /**
   * Handle scroll event on right panel
   * If in sync mode, update left panel to match
   */
  handleRightScroll(
    leftElement: HTMLElement | null,
    rightElement: HTMLElement | null,
    scrollPosition: number
  ): void {
    if (!leftElement || !rightElement) return;

    this.state.rightScrollPosition = scrollPosition;

    if (this.state.mode === 'sync') {
      // Calculate ratio based on scrollable heights
      const leftScrollHeight = leftElement.scrollHeight - leftElement.clientHeight;
      const rightScrollHeight = rightElement.scrollHeight - rightElement.clientHeight;

      if (leftScrollHeight > 0 && rightScrollHeight > 0) {
        const ratio = leftScrollHeight / rightScrollHeight;
        leftElement.scrollTop = scrollPosition * ratio;
        this.state.leftScrollPosition = scrollPosition * ratio;
      }
    }
  }

  /**
   * Scroll both panels to a specific line (useful for search/navigation)
   */
  scrollToLine(
    leftElement: HTMLElement | null,
    rightElement: HTMLElement | null,
    lineHeight: number,
    lineNumber: number
  ): void {
    const targetScroll = lineHeight * lineNumber;

    if (leftElement) {
      leftElement.scrollTop = targetScroll;
      this.state.leftScrollPosition = targetScroll;
    }

    if (rightElement && this.state.mode !== 'independent') {
      rightElement.scrollTop = targetScroll;
      this.state.rightScrollPosition = targetScroll;
    }
  }

  /**
   * Reset scroll state
   */
  reset(): void {
    this.state = {
      mode: 'sync',
      leftScrollPosition: 0,
      rightScrollPosition: 0,
      isDragging: false,
    };
  }

  /**
   * Get current state
   */
  getState(): ScrollState {
    return { ...this.state };
  }
}

// Export singleton instance
export default new ScrollSyncService();
