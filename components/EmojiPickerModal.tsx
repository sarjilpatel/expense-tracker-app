import React, { useState, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList, TextInput,
  StyleSheet, Platform, KeyboardAvoidingView, Pressable, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
const CELL_SIZE = Math.floor((Dimensions.get('window').width - 16) / NUM_COLS);

export function EmojiPickerModal({ visible, onClose, onSelect, theme }: Props) {
  const [search, setSearch]     = useState('');
  const [activeTab, setActiveTab] = useState('smileys');

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return ALL_EMOJIS.filter(e => e.includes(q) || q.split('').some(ch => e.includes(ch)));
    }
    return CATEGORIES.find(c => c.id === activeTab)?.emojis ?? [];
  }, [search, activeTab]);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
  };

  const handleClose = () => {
    setSearch('');
    setActiveTab('smileys');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card }]} onPress={e => e.stopPropagation()}>

            <View style={[styles.handle, { backgroundColor: theme.border }]} />

            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Pick an Emoji</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchRow, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
              <Ionicons name="search-outline" size={15} color={theme.secondaryText} style={{ marginRight: 6 }} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search..."
                placeholderTextColor={theme.secondaryText}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={15} color={theme.secondaryText} />
                </TouchableOpacity>
              )}
            </View>

            {!search.trim() && (
              <FlatList
                data={CATEGORIES}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={c => c.id}
                style={[styles.tabRow, { borderBottomColor: theme.border }]}
                contentContainerStyle={styles.tabRowContent}
                renderItem={({ item }) => {
                  const active = activeTab === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.tab, active && { borderBottomColor: theme.tint, borderBottomWidth: 2, backgroundColor: theme.tint + '18' }]}
                      onPress={() => setActiveTab(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.tabIcon}>{item.icon}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <FlatList
              data={displayed}
              numColumns={NUM_COLS}
              keyExtractor={(item, i) => item + i}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.cell} onPress={() => handleSelect(item)} activeOpacity={0.65}>
                  <Text style={styles.emoji}>{item}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={[styles.emptyText, { color: theme.secondaryText }]}>No results</Text>
                </View>
              }
            />

          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  kav:       { justifyContent: 'flex-end' },
  sheet:     { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 32 : 16, maxHeight: '75%' },
  handle:    { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6, opacity: 0.5 },

  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginVertical: 8,
    borderRadius: 10, paddingHorizontal: 10, height: 36,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },

  tabRow:        { borderBottomWidth: StyleSheet.hairlineWidth, flexGrow: 0, flexShrink: 0 },
  tabRowContent: { paddingHorizontal: 4 },
  tab:           { width: 44, height: 42, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabIcon:       { fontSize: 22 },

  grid:  { paddingHorizontal: 4, paddingVertical: 4 },
  cell:  { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  emoji: { fontSize: 26 },

  empty:     { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 14 },
});
