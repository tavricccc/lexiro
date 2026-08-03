import { DotLottie } from '@lottiefiles/dotlottie-web'
import { CONFETTI_LOTTIE, STUDY_DISCUSSION_LOTTIE } from '@/constants/animations'

export function preloadLottieAssets() {
  void DotLottie.preload().catch(() => undefined)
  for (const source of [STUDY_DISCUSSION_LOTTIE, CONFETTI_LOTTIE])
    void fetch(source, { cache: 'force-cache' }).catch(() => undefined)
}
