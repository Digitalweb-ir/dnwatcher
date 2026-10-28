/**
 * مدیریت کننده صف برای پردازش ترتیبی تست‌های لتنسی.
 *
 * هدف: جلوگیری از تداخل در شبکه و فشار به CPU با اجرای تست‌ها به صورت یک-به-یک.
 * این کار باعث می‌شود هر تست در پاک‌ترین حالت ممکن اجرا شود و نتایج دقیق‌تر باشند.
 */
export class LatencyQueue<T, R> {
  private queue: { task: () => Promise<R>; resolve: (value: R) => void; reject: (reason?: any) => void }[] = []
  private processing = false

  /** افزودن یک تسک به صف و دریافت Promise نتیجه */
  async add(task: () => Promise<R>): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject })
      this.processNext()
    })
  }

  private async processNext() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true
    const { task, resolve, reject } = this.queue.shift()!

    try {
      const result = await task()
      resolve(result)
    } catch (error) {
      reject(error)
    } finally {
      this.processing = false
      this.processNext()
    }
  }

  get pendingCount(): number {
    return this.queue.length
  }

  clear() {
    this.queue = []
  }
}
