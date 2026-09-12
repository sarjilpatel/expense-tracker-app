import React from 'react';
import { router } from 'expo-router';
import { Card, Row, EmptyState, SectionHeader } from '@/components/ui';

interface Props {
  /** The group the user is currently active in — may be their personal one. */
  group: any;
  /** Every group they belong to. Decides prompt-vs-card; without it a shared group they are not
   *  currently active in becomes unreachable. */
  groups?: any[];
}

/**
 * Every account owns a personal group — it is where their categories live — so "has a group" is
 * no longer the same question as "shares expenses with anyone".
 *
 * The question that decides what this section shows is whether they belong to *any* shared group,
 * not whether the active one is shared. Asking it of the active group alone stranded people:
 * create a group, switch back to Personal from `manage-group`, and this section fell back to the
 * create-or-join prompt — which is the only route into `manage-group`, so the group they had just
 * made could not be reached again (W1-36).
 */
export function GroupSection({ group, groups = [] }: Props) {
  const shared = groups.filter((g: any) => g && !g.isPersonal);
  const hasShared = shared.length > 0 || (group && !group.isPersonal);

  if (!hasShared) {
    return (
      <>
        <SectionHeader title="Group" />
        <Card>
          <EmptyState
            compact
            icon="people-outline"
            title="No group yet"
            body="Create a shared group to split expenses with family or a team."
            action={{ label: 'Create or join a group', onPress: () => router.push('/group-setup') }}
          />
        </Card>
      </>
    );
  }

  const members = group?.members?.length || 0;
  return (
    <>
      <SectionHeader title="Group" />
      <Card padded={false}>
        <Row
          icon={group?.isPersonal ? 'person' : 'people'}
          title={group?.name}
          // Active in their own space while still belonging to a shared group: the meta has to say
          // the switcher is in there, or this reads as a dead end.
          subtitle={group?.isPersonal
            ? `Just you · switch to ${shared.length === 1 ? shared[0].name : 'a group'}`
            : `${members} member${members !== 1 ? 's' : ''} · manage`}
          onPress={() => router.push('/manage-group')}
          last
        />
      </Card>
    </>
  );
}
