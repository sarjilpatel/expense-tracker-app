import React, { useEffect, useRef } from 'react';
import { Sheet, Card, Row, EmptyState, type SheetHandle } from '@/components/ui';

export interface Notification {
  id: string;
  type: 'income' | 'expense';
  title: string;
  message: string;
  time: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  notifications: Notification[];
  theme: any;
}

/** Recent activity, on the shared `Sheet` (W2-11). `visible` drives present/dismiss. */
export function NotificationsModal({ visible, onClose, notifications, theme }: Props) {
  const sheet = useRef<SheetHandle>(null);

  useEffect(() => {
    if (visible) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [visible]);

  return (
    <Sheet ref={sheet} title="Notifications" scroll snapPoints={['70%']} keyboard="none" onDismiss={onClose}>
      {notifications.length === 0 ? (
        <EmptyState compact icon="notifications-off-outline" title="Everything caught up" body="New activity in your group shows up here." />
      ) : (
        <Card padded={false}>
          {notifications.map((notif, i) => (
            <Row
              key={notif.id}
              icon={notif.type === 'income' ? 'arrow-down' : 'arrow-up'}
              iconColor={notif.type === 'income' ? theme.income : theme.expense}
              title={notif.title}
              subtitle={`${notif.message} · ${notif.time}`}
              last={i === notifications.length - 1}
            />
          ))}
        </Card>
      )}
    </Sheet>
  );
}
