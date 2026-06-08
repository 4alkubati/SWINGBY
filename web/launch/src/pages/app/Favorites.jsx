import { Heart } from '@phosphor-icons/react'
import EmptyState from '../../components/EmptyState'
import styles from './Dashboard.module.css'

export default function Favorites() {
  return (
    <div>
      <h1 className={styles.pageTitle}>Saved businesses</h1>
      <EmptyState icon={<Heart size={48} />} title="No saved businesses yet" description="Browse businesses and save ones you'd like to book again." />
    </div>
  )
}
