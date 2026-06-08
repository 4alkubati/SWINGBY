import { MagnifyingGlass } from '@phosphor-icons/react'
import EmptyState from '../../components/EmptyState'
import styles from './Dashboard.module.css'

export default function SavedSearches() {
  return (
    <div>
      <h1 className={styles.pageTitle}>Saved searches</h1>
      <EmptyState icon={<MagnifyingGlass size={48} />} title="No saved searches" description="Save a search to get notified when matching businesses post availability." />
    </div>
  )
}
