import React, { useState, useCallback } from 'react';
import {
  View,
  SafeAreaView,
  StyleSheet,
  FlatList,
  Text,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StorageService } from '@services/storage';
import { ScannedItem } from '@utils/types';
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  BORDER_RADIUS,
  SCREEN_NAMES,
} from '@utils/constants';
import { getTimeAgo, sortItems, filterItems } from '@utils/helpers';
import { EmptyStateList } from '@components/EmptyState';
import { getTestID, getListItemAccessibility } from '@utils/accessibilityUtils';

interface LibraryScreenProps {
  navigation: any;
}

type SortBy = 'recent' | 'name' | 'played';

const LibraryScreen: React.FC<LibraryScreenProps> = ({ navigation }) => {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ScannedItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [])
  );

  const loadItems = async () => {
    try {
      setIsLoading(true);
      const loadedItems = await StorageService.getScannedItems();
      setItems(loadedItems);
      applyFilters(loadedItems, searchText, sortBy);
    } catch (error) {
      console.error('Error loading items:', error);
      Alert.alert('Error', 'Failed to load scanned items');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadItems();
    } finally {
      setRefreshing(false);
    }
  };

  const applyFilters = (data: ScannedItem[], search: string, sort: SortBy) => {
    let result = filterItems(data, search);
    result = sortItems(result, sort);
    setFilteredItems(result);
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    applyFilters(items, text, sortBy);
  };

  const handleSort = (newSort: SortBy) => {
    setSortBy(newSort);
    applyFilters(items, searchText, newSort);
  };

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleDeleteItem = (itemId: string) => {
    Alert.alert('Delete Item', 'Are you sure you want to delete this scanned item?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await StorageService.deleteScannedItem(itemId);
            setItems(items.filter((item) => item.id !== itemId));
            applyFilters(
              items.filter((item) => item.id !== itemId),
              searchText,
              sortBy
            );
          } catch (error) {
            Alert.alert('Error', 'Failed to delete item');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleDeleteSelected = () => {
    if (selectedItems.size === 0) return;

    Alert.alert(
      'Delete Items',
      `Are you sure you want to delete ${selectedItems.size} item(s)?`,
      [
        { text: 'Cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              const itemIds = Array.from(selectedItems);
              await StorageService.deleteMultipleItems(itemIds);
              const updatedItems = items.filter((item) => !itemIds.includes(item.id));
              setItems(updatedItems);
              applyFilters(updatedItems, searchText, sortBy);
              setSelectedItems(new Set());
            } catch (error) {
              Alert.alert('Error', 'Failed to delete items');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="music-box-outline" size={64} color={COLORS.textSecondary} />
      <Text style={styles.emptyTitle}>No Scanned Music</Text>
      <Text style={styles.emptySubtitle}>
        Start by scanning sheet music from your camera or photos
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => navigation.navigate(SCREEN_NAMES.HOME)}
      >
        <MaterialIcons name="add" size={24} color="white" />
        <Text style={styles.emptyButtonText}>Scan Music</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item, index }: { item: ScannedItem; index: number }) => {
    const isSelected = selectedItems.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.itemCard, isSelected && styles.itemCardSelected]}
        onPress={() => navigation.navigate(SCREEN_NAMES.VIEWER, { itemId: item.id })}
        onLongPress={() => handleSelectItem(item.id)}
        activeOpacity={0.7}
        testID={getTestID('library', `item-${item.id}`)}
        {...getListItemAccessibility(index + 1, filteredItems.length, item.filename || 'Scanned Music')}
      >
        {/* Offline Badge */}
        <View style={styles.offlineBadge}>
          <MaterialCommunityIcons name="cloud-off-outline" size={12} color="#4CAF50" />
          <Text style={styles.offlineBadgeText}>Offline</Text>
        </View>

        {/* Checkbox */}
        <View style={styles.checkboxContainer}>
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <MaterialIcons name="check" size={16} color="white" />}
          </View>
        </View>

        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {item.thumbnailPath ? (
            <Image source={{ uri: item.thumbnailPath }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <MaterialCommunityIcons name="music" size={32} color={COLORS.primary} />
            </View>
          )}
        </View>

        {/* Item Info */}
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.musicData?.title || item.filename}
          </Text>
          <Text style={styles.itemComposer} numberOfLines={1}>
            {item.musicData?.composer || 'Unknown Composer'}
          </Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemDate}>{getTimeAgo(item.dateScanned)}</Text>
            {item.playCount > 0 && (
              <View style={styles.playCountBadge}>
                <MaterialIcons name="play-arrow" size={12} color={COLORS.primary} />
                <Text style={styles.playCountText}>{item.playCount}</Text>
              </View>
            )}
            {/* Confidence Badge */}
            {item.confidence && (
              <View
                style={[
                  styles.confidenceBadge,
                  {
                    backgroundColor:
                      item.confidence > 0.8
                        ? 'rgba(76, 175, 80, 0.1)'
                        : item.confidence > 0.6
                          ? 'rgba(255, 193, 7, 0.1)'
                          : 'rgba(244, 67, 54, 0.1)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.confidenceBadgeText,
                    {
                      color:
                        item.confidence > 0.8
                          ? '#4CAF50'
                          : item.confidence > 0.6
                            ? '#FFC107'
                            : '#F44336',
                    },
                  ]}
                >
                  {Math.round(item.confidence * 100)}%
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Menu Button */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() =>
            Alert.alert('Options', 'Choose an action', [
              { text: 'Cancel' },
              { text: 'View', onPress: () => navigation.navigate(SCREEN_NAMES.VIEWER, { itemId: item.id }) },
              { text: 'Share', onPress: () => {} },
              {
                text: 'Delete',
                onPress: () => handleDeleteItem(item.id),
                style: 'destructive',
              },
            ])
          }
        >
          <MaterialIcons name="more-vert" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Music Library</Text>
        {selectedItems.size > 0 && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteSelected}
          >
            <MaterialIcons name="delete" size={20} color={COLORS.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title or composer..."
          placeholderTextColor={COLORS.textSecondary}
          value={searchText}
          onChangeText={handleSearch}
        />
        {searchText !== '' && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <MaterialIcons name="close" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sort & Filter Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'recent' && styles.sortButtonActive]}
          onPress={() => handleSort('recent')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'recent' && styles.sortButtonTextActive]}>
            Recent
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
          onPress={() => handleSort('name')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'name' && styles.sortButtonTextActive]}>
            Name
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'played' && styles.sortButtonActive]}
          onPress={() => handleSort('played')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'played' && styles.sortButtonTextActive]}>
            Most Played
          </Text>
        </TouchableOpacity>
      </View>

      {/* Items List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : filteredItems.length === 0 && items.length === 0 ? (
        renderEmptyState()
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptySearchContainer}>
          <MaterialIcons name="search-off" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptySearchText}>No results found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            !isLoading ? (
              <EmptyStateList
                icon="music-box-outline"
                title="No Scans Yet"
                message="Start scanning sheet music to build your collection"
                buttonText="Scan Now"
                onButtonPress={() => navigation.navigate('HomeStack', { screen: 'Scanner' })}
              />
            ) : null
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          windowSize={10}
          maxToRenderPerBatch={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
          scrollIndicatorInsets={{ right: 1 }}
          initialNumToRender={15}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(234, 67, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    ...TYPOGRAPHY.body1,
    color: COLORS.text,
  },
  controlsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  sortButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sortButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sortButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sortButtonTextActive: {
    color: 'white',
  },
  listContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  separator: {
    height: SPACING.md,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
    gap: SPACING.md,
  },
  itemCardSelected: {
    backgroundColor: 'rgba(26, 115, 232, 0.1)',
  },
  checkboxContainer: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  thumbnailContainer: {
    width: 60,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.border,
  },
  itemInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  itemTitle: {
    ...TYPOGRAPHY.body1,
    color: COLORS.text,
    fontWeight: '600',
  },
  itemComposer: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  itemDate: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  playCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(26, 115, 232, 0.1)',
  },
  playCountText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '600',
  },
  offlineBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  offlineBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4CAF50',
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  menuButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.body2,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  emptyButtonText: {
    ...TYPOGRAPHY.button,
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySearchContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptySearchText: {
    ...TYPOGRAPHY.body1,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
});

export default LibraryScreen;
