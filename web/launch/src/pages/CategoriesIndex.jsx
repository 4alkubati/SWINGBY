import { Link } from 'react-router-dom'
import { Broom, Wrench, Lightning, Plant, PaintBrush, Hammer, Toolbox, Car, Truck, Dog, Desktop, Scissors } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import styles from './page.module.css'

export const CATEGORIES = [
  { slug: 'cleaning', name: 'Cleaning', Icon: Broom, desc: 'House, apartment, and office cleaning' },
  { slug: 'plumbing', name: 'Plumbing', Icon: Wrench, desc: 'Leaks, installs, drain work' },
  { slug: 'electrical', name: 'Electrical', Icon: Lightning, desc: 'Panel, outlets, lighting, EV chargers' },
  { slug: 'landscaping', name: 'Landscaping', Icon: Plant, desc: 'Lawn care, snow removal, garden' },
  { slug: 'painting', name: 'Painting', Icon: PaintBrush, desc: 'Interior, exterior, cabinet finishing' },
  { slug: 'carpentry', name: 'Carpentry', Icon: Hammer, desc: 'Custom builds, trim, decking' },
  { slug: 'handyman', name: 'Handyman', Icon: Toolbox, desc: 'Small repairs and installs' },
  { slug: 'moving', name: 'Moving', Icon: Truck, desc: 'Local moves, packing, hauling' },
  { slug: 'auto', name: 'Auto services', Icon: Car, desc: 'Detailing, mobile mechanic' },
  { slug: 'pet-care', name: 'Pet care', Icon: Dog, desc: 'Dog walking, grooming, sitting' },
  { slug: 'tech', name: 'Tech support', Icon: Desktop, desc: 'Computer repair, setup, networks' },
  { slug: 'beauty', name: 'Beauty', Icon: Scissors, desc: 'Hair, nails, mobile services' },
]

export default function CategoriesIndex() {
  return (
    <>
      <SEO title="All categories" description="Browse all service categories on SwingBy. Cleaning, plumbing, electrical, landscaping, and more in Calgary." />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>All categories</h1>
          <p className={styles.pageSubtitle}>Browse services available in Calgary.</p>
        </div>
        <div className={styles.section}>
          <div className={styles.grid3}>
            {CATEGORIES.map(({ slug, name, Icon, desc }) => (
              <Link key={slug} to={`/categories/${slug}`} style={{ textDecoration: 'none' }}>
                <div className={styles.card} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ color: 'var(--color-accent-text)', flexShrink: 0 }}><Icon size={28} weight="regular" /></div>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>{name}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
