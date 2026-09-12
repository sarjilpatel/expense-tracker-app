import React from 'react';
import { Linking } from 'react-native';
import { Screen, Card, Row, SectionHeader } from '@/components/ui';

export default function HelpScreen() {
  return (
    <Screen title="Help">
      <SectionHeader title="Legal" />
      <Card padded={false}>
        <Row icon="shield-checkmark-outline" title="Privacy policy" subtitle="How we collect and use your data" onPress={() => Linking.openURL('https://sarjilpatel.github.io/expense-tracker/privacy')} />
        <Row icon="document-text-outline" title="Terms of service" subtitle="Rules and conditions of use" onPress={() => Linking.openURL('https://sarjilpatel.github.io/expense-tracker/terms')} last />
      </Card>

      <SectionHeader title="Support" />
      <Card padded={false}>
        <Row icon="mail-outline" title="Contact support" subtitle="Get help with the app" onPress={() => Linking.openURL('mailto:sarjilpatel2903@gmail.com?subject=Expense%20Tracker%20Support')} last />
      </Card>

      <SectionHeader title="About" />
      <Card padded={false}>
        <Row icon="information-circle-outline" title="Version" subtitle="1.0.0" last />
      </Card>
    </Screen>
  );
}
