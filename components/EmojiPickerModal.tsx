import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { space, radius, icon as iconSize } from '@/constants/tokens';
import { Sheet, Touchable, Field, EmptyState, type SheetHandle } from '@/components/ui';

const CATEGORIES: { id: string; icon: string; label: string; emojis: string[] }[] = [
  {
    id: 'smileys', icon: '😀', label: 'Smileys',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔',
      '🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷',
      '🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐',
      '😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭',
      '😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️',
      '💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
    ],
  },
  {
    id: 'people', icon: '👋', label: 'People',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆',
      '🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🙏','🤝',
      '💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','👅','👁️','👀','👣',
      '💋','💏','💑','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','👴','👵','🧓',
      '👮','💂','🕵️','👷','🤴','👸','🎅','🤶','🧙','🧚','🧛','🧜','🧝','🧞','🧟',
      '💆','💇','🚶','🧍','🧎','🏃','💃','🕺','👫','👬','👭','🫂',
    ],
  },
  {
    id: 'animals', icon: '🐶', label: 'Animals',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈',
      '🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛',
      '🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐',
      '🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣',
      '🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙',
      '🐐','🦌','🐕','🐩','🦮','🐈','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝',
      '🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔',
      '🌵','🎄','🌲','🌳','🌴','🌱','🌿','☘️','🍀','🍃','🍂','🍁','🍄','🌾','🌷','🌹',
      '🥀','🌺','🌸','🌼','🌻','🌞','🌝','🌛','🌜','🌚','🌕','🌙','🌟','⭐','✨','🌈',
      '⛅','🌤️','☁️','⛈️','🌪️','🌊','🌋','🏔️','⛰️',
    ],
  },
  {
    id: 'food', icon: '🍔', label: 'Food',
    emojis: [
      '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍑','🥭','🍍','🥥','🥝',
      '🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥯',
      '🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟',
      '🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🍝','🍜','🍲','🍛','🍣',
      '🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬',
      '🍫','🍿','🍩','🍪','🌰','🥜','🍯','☕','🍵','🫖','🧃','🥤','🧋','🍺','🍻','🥂',
      '🍷','🥃','🍸','🍹','🧉','🍾','🧊','🍴','🍽️','🥢','🥄',
    ],
  },
  {
    id: 'travel', icon: '✈️', label: 'Travel',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵',
      '🛺','🚲','🛴','🛹','🚏','⛽','🚨','🚥','🚦','🛑','✈️','🛫','🛬','💺','🚀','🛸',
      '🚁','🛶','⛵','🛥️','🚢','⚓','🗺️','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️',
      '🏗️','🏘️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭',
      '🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','⛩️','🕍','🌁','🌃','🌄','🌅','🌆','🌇',
      '🌉','🎠','🎡','🎢','🎪','🌐','🗾','🏔️','⛰️','🌋','🗻',
    ],
  },
  {
    id: 'activities', icon: '⚽', label: 'Sports',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🏑','🥍','🏏',
      '🪃','🥅','⛳','🪁','🎣','🤿','🎽','🎿','🛷','🥌','🎯','🪀','🎲','♟️','🧩','🧸',
      '🪆','🎭','🎨','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🪗','🎬',
      '🎥','📽️','📺','🎮','🕹️','🎰','🎳','🎯','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️',
      '🎫','🎟️','🎪','🤸','🏋️','⛹️','🤼','🤾','🏊','🚴','🏇','🤺','🥋','🤼','🤹',
    ],
  },
  {
    id: 'objects', icon: '💡', label: 'Objects',
    emojis: [
      '⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','💽','💾','💿','📀','📼','📷','📸','📹','🎥',
      '📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌',
      '💡','🔦','🕯️','🪔','🧯','💰','💳','💵','💸','🪙','💹','📈','📉','📊','📋','📌',
      '📍','🗂️','🗃️','🗑️','🔒','🔓','🔑','🗝️','🔨','🪓','⚒️','🛠️','⚔️','🛡️','🔧',
      '🔩','⚙️','⚖️','🔗','🧲','🪜','⚗️','🧪','🧫','🧬','🔭','🔬','💊','🩹','🩺','🩻',
      '🩸','🧴','🧷','🧹','🧺','🧻','🪣','🧼','🪥','🧽','🛒','🚪','🛏️','🛋️','🪑','🚽',
      '🪠','🚿','🛁','🪒','🧸','🪆','🖼️','🪞','🪟','🧳','⛱️','🌂','☂️','🎁','🎀',
      '🎊','🎉','🎈','🎏','🎐','🎑','🧧','🎃','🎄','🎆','🎇','🧨',
    ],
  },
  {
    id: 'symbols', icon: '❤️', label: 'Symbols',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
      '💘','💝','💟','☮️','✝️','☪️','🕉️','✡️','🔯','☯️','☦️','🛐','♈','♉','♊','♋',
      '♌','♍','♎','♏','♐','♑','♒','♓','⛎','🔱','📛','🔰','♻️','✅','❎','💯',
      '✨','🔝','🆙','🆒','🆕','🆓','🆔','🔃','↩️','↪️','⤴️','⤵️','🔀','🔁','▶️',
      '⏩','◀️','⏪','🔼','🔽','⏸️','⏹️','⏺️','🔅','🔆','📶','🔕','🔔','💬','💭',
      '🗯️','🔤','🔡','🔠','🆎','🆑','🆘','❌','⭕','🛑','⛔','🔞','💲','♠️','♣️',
      '♥️','♦️','🃏','🀄','🎴','🌀','🔵','🟤','⚫','⚪','🟣','🔴','🟠','🟡','🟢',
      '#️⃣','*️⃣','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟',
    ],
  },
];

const ALL_EMOJIS = CATEGORIES.flatMap(c => c.emojis);

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  theme: any;
}

const NUM_COLS = 8;

/** Emoji chooser on the shared `Sheet` (W2-11). `visible` drives present/dismiss. */
export function EmojiPickerModal({ visible, onClose, onSelect, theme }: Props) {
  const sheet = useRef<SheetHandle>(null);
  const { width } = useWindowDimensions();
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState('smileys');

  useEffect(() => {
    if (visible) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [visible]);

  // The sheet body is inset by `space.lg` on each side.
  const cell = Math.floor((width - space.lg * 2) / NUM_COLS);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return ALL_EMOJIS.filter(e => e.includes(q) || q.split('').some(ch => e.includes(ch)));
    }
    return CATEGORIES.find(c => c.id === activeTab)?.emojis ?? [];
  }, [search, activeTab]);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    sheet.current?.dismiss();
  };

  const handleDismiss = () => {
    setSearch('');
    setActiveTab('smileys');
    onClose();
  };

  return (
    <Sheet ref={sheet} title="Pick an emoji" scroll snapPoints={['75%']} onDismiss={handleDismiss}>
      <Field
        icon="search-outline"
        placeholder="Search…"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel="Search emoji"
        right={search.length > 0 ? (
          <Touchable onPress={() => setSearch('')} size={28} accessibilityLabel="Clear search" rippleBorderless>
            <Ionicons name="close-circle" size={iconSize.sm} color={theme.secondaryText} />
          </Touchable>
        ) : undefined}
      />

      {!search.trim() && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[S.tabRow, { borderBottomColor: theme.border }]} contentContainerStyle={S.tabRowContent}>
          {CATEGORIES.map(c => {
            const active = activeTab === c.id;
            return (
              <Touchable
                key={c.id}
                onPress={() => setActiveTab(c.id)}
                haptic="selection"
                size={44}
                style={[S.tab, active && { borderBottomColor: theme.tint, backgroundColor: theme.tint + '18' }]}
                accessibilityLabel={c.label}
                accessibilityState={{ selected: active }}
                rippleBorderless
              >
                <Text style={S.tabIcon}>{c.icon}</Text>
              </Touchable>
            );
          })}
        </ScrollView>
      )}

      {displayed.length === 0 ? (
        <EmptyState compact icon="search-outline" title="No results" />
      ) : (
        <View style={S.grid}>
          {displayed.map((item, i) => (
            <Touchable key={item + i} onPress={() => handleSelect(item)} haptic="selection" size={cell} style={[S.cell, { width: cell, height: cell }]} accessibilityLabel={item} rippleBorderless>
              <Text style={S.emoji}>{item}</Text>
            </Touchable>
          ))}
        </View>
      )}
    </Sheet>
  );
}

const S = StyleSheet.create({
  tabRow:        { borderBottomWidth: StyleSheet.hairlineWidth, flexGrow: 0, flexShrink: 0, marginTop: space.md },
  tabRowContent: { paddingHorizontal: space.xs },
  tab:           { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', borderRadius: radius.sm },
  tabIcon:       { fontSize: 22 },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', paddingTop: space.sm },
  cell:          { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  emoji:         { fontSize: 26 },
});
