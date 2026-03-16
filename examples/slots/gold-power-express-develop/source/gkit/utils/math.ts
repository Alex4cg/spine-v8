export class MathUtils {
  static limitedInterpolation(from: number, to: number, currentStep: number, totalSteps: number) {
    const value = from + ((to - from) * (currentStep / totalSteps))

    if (from > to) {
      return value < to ? to : value
    }

    return value > to ? to : value
  }
}
