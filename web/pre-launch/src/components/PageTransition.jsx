import { motion } from 'framer-motion'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const pageTransition = {
  duration: 0.24,
  ease: [0, 0, 0.2, 1], // ease-out entry (--ease-entry / --duration-entry)
}

const pageExitTransition = {
  duration: 0.18,
  ease: [0.4, 0, 1, 1], // ease-in exit (--ease-exit / --duration-exit)
}

export default function PageTransition({ children }) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      transition={{
        ...pageTransition,
        exit: pageExitTransition,
      }}
      style={{ minHeight: '100vh' }}
    >
      {children}
    </motion.div>
  )
}
