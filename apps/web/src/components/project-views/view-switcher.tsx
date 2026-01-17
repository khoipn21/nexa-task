import { type ViewMode, useViewPreference } from '@/hooks/use-view-preference'
import { SegmentedControl } from '@mantine/core'

interface ViewSwitcherProps {
  projectId: string
}

export function ViewSwitcher({ projectId }: ViewSwitcherProps) {
  const { viewMode, setViewMode } = useViewPreference(projectId)

  return (
    <SegmentedControl
      value={viewMode}
      onChange={(value) => setViewMode(value as ViewMode)}
      data={[
        { label: 'Kanban', value: 'kanban' },
        { label: 'List', value: 'list' },
        { label: 'Calendar', value: 'calendar' },
      ]}
    />
  )
}
