import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Rocket, BookOpen, Users, Eye } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import shared from './page.module.css'
import s from './About.module.css'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

const TEAM = [
  { nameKey: 'about.member1Name', roleKey: 'about.member1Role', bioKey: 'about.member1Bio' },
  { nameKey: 'about.member2Name', roleKey: 'about.member2Role', bioKey: 'about.member2Bio' },
  { nameKey: 'about.member3Name', roleKey: 'about.member3Role', bioKey: 'about.member3Bio' },
]

export default function About() {
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title="About SwingBy"
        description="Learn about SwingBy's mission, story, and the team building the future of local services in Calgary."
        og={{ url: 'https://swingbyy.com/about' }}
      />

      {/* Hero */}
      <section className={shared.heroSection}>
        <motion.div {...fadeUp}>
          <h1 className={shared.heroTitle}>{t('about.heroTitle')}</h1>
          <p className={shared.heroSubtitle}>{t('about.heroSubtitle')}</p>
        </motion.div>
      </section>

      <div className={s.container}>
        {/* Mission */}
        <motion.section className={s.block} {...fadeUp}>
          <div className={s.blockIcon}>
            <Rocket size={28} weight="regular" />
          </div>
          <h2 className={s.blockTitle}>{t('about.missionTitle')}</h2>
          <p className={s.blockText}>{t('about.missionDesc')}</p>
        </motion.section>

        {/* Story */}
        <motion.section className={s.block} {...fadeUp}>
          <div className={s.blockIcon}>
            <BookOpen size={28} weight="regular" />
          </div>
          <h2 className={s.blockTitle}>{t('about.storyTitle')}</h2>
          <p className={s.blockText}>{t('about.storyP1')}</p>
          <p className={s.blockText}>{t('about.storyP2')}</p>
        </motion.section>

        <hr className={shared.divider} />

        {/* Team */}
        <motion.section {...fadeUp}>
          <div className={s.teamHeader}>
            <Users size={28} weight="regular" className={s.teamHeaderIcon} />
            <h2 className={s.blockTitle}>{t('about.teamTitle')}</h2>
          </div>
          <div className={shared.grid3}>
            {TEAM.map((member, i) => (
              <motion.div
                key={member.nameKey}
                className={s.teamCard}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.1 }}
              >
                <div className={s.avatar} />
                <h3 className={s.memberName}>{t(member.nameKey)}</h3>
                <span className={s.memberRole}>{t(member.roleKey)}</span>
                <p className={s.memberBio}>{t(member.bioKey)}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <hr className={shared.divider} />

        {/* Vision */}
        <motion.section className={s.visionBlock} {...fadeUp}>
          <Eye size={32} weight="regular" className={s.visionIcon} />
          <h2 className={s.visionTitle}>{t('about.visionTitle')}</h2>
          <p className={s.visionDesc}>{t('about.visionDesc')}</p>
        </motion.section>
      </div>
    </>
  )
}
