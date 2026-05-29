import Lottie from 'lottie-react'
import heroAnimation from '../assets/lottie/hero.json'
import styles from './HeroLottie.module.css'

// Replace hero.json with your custom Bodymovin export for the final asset.
export default function HeroLottie() {
  return (
    <div className={styles.wrapper} aria-hidden="true">
      <Lottie
        animationData={heroAnimation}
        loop
        autoplay
        className={styles.lottie}
      />
    </div>
  )
}
