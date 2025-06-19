import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ShoppingBag, ExternalLink, Star, TrendingUp, Zap, ArrowRight, Crown, Lock, User, Calendar, BarChart3, Share2 } from 'lucide-react';
import { recommendationService, OutfitRecommendation, ShoppingListItem } from '../services/recommendationService';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import SubscriptionModal from '../components/SubscriptionModal';
import RealisticAvatar from '../components/Avatar3D';
import StyleInsights from '../components/StyleInsights';
import SocialSharing from '../components/SocialSharing';
import OutfitCalendar from '../components/OutfitCalendar';
import FashionBackground from '../components/FashionBackground';

const occasions = [
  'Casual',
  'Work',
  'Date Night',
  'Party',
  'Formal',
  'Weekend',
  'Travel',
];

const RecommendationsPage: React.FC = () => {
  const { items } = useWardrobe();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<OutfitRecommendation[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [selectedOccasion, setSelectedOccasion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [wardrobeAnalysis, setWardrobeAnalysis] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'outfits' | 'shopping' | 'insights' | 'calendar'>('outfits');
  const [showSmartSuggestion, setShowSmartSuggestion] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [accessInfo, setAccessInfo] = useState<any>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const [selectedOutfitForModel, setSelectedOutfitForModel] = useState<number>(0);

  const fetchRecommendations = async () => {
    try {
      setIsLoading(true);
      const response = await recommendationService.getOutfitRecommendations(selectedOccasion || undefined);
      
      if (response.subscriptionRequired) {
        setSubscriptionRequired(true);
        setAccessInfo(response);
        return;
      }
      
      setRecommendations(response.recommendations || []);
      setWardrobeAnalysis(response.wardrobeAnalysis);
      setSubscriptionInfo(response.subscriptionInfo);
      setAccessInfo(response.accessInfo);
      
      // Check if any recommendations have low confidence
      const hasLowConfidence = response.recommendations?.some(rec => rec.confidence < 0.8);
      setShowSmartSuggestion(hasLowConfidence);
    } catch (error: any) {
      console.error('Failed to fetch recommendations:', error);
      if (error.response?.status === 403) {
        setSubscriptionRequired(true);
        setAccessInfo(error.response.data);
      } else {
        setRecommendations([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShoppingList = async () => {
    try {
      setIsLoading(true);
      const response = await recommendationService.getSmartShoppingList();
      setShoppingList(response.shoppingList || []);
    } catch (error) {
      console.error('Failed to fetch shopping list:', error);
      setShoppingList([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMakeItSmarter = () => {
    // Navigate to marketplace with smart filters based on low-confidence recommendations
    const lowConfidenceRecs = recommendations.filter(rec => rec.confidence < 0.8);
    if (lowConfidenceRecs.length > 0) {
      // Extract missing categories from low confidence recommendations
      const missingCategories = lowConfidenceRecs
        .flatMap(rec => rec.missingItems || [])
        .map(item => item.category);
      
      const uniqueCategories = [...new Set(missingCategories)];
      const primaryCategory = uniqueCategories[0] || 'Tops';
      
      // Navigate to marketplace with pre-filled filters
      navigate(`/marketplace?category=${primaryCategory}&smart=true`);
    } else {
      navigate('/marketplace');
    }
  };

  const handleShoppingItemClick = (item: ShoppingListItem) => {
    // Navigate to marketplace with the specific item category
    navigate(`/marketplace?category=${item.category}&smart=true`);
  };

  const handleSubscriptionSuccess = () => {
    setShowSubscriptionModal(false);
    setSubscriptionRequired(false);
    fetchRecommendations();
  };

  const handlePlanOutfit = (date: string, occasion: string) => {
    setSelectedOccasion(occasion);
    setActiveTab('outfits');
    fetchRecommendations();
  };

  useEffect(() => {
    if (items.length > 0) {
      if (activeTab === 'outfits') {
        fetchRecommendations();
      } else if (activeTab === 'shopping') {
        fetchShoppingList();
      }
    }
  }, [items.length, selectedOccasion, activeTab]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'Great Match';
    if (confidence >= 0.6) return 'Good Match';
    return 'Needs Improvement';
  };

  const getOutfitItems = (recommendation: OutfitRecommendation) => {
    return items.filter(item => recommendation.items.includes(item.id));
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <FashionBackground />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <Sparkles className="h-16 w-16 text-primary-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No Items in Wardrobe</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Add some items to your wardrobe to get personalized outfit recommendations and shopping suggestions.
            </p>
            <a href="/wardrobe" className="btn-primary">
              Add Items to Wardrobe
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <FashionBackground />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/20"
        >
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Style Assistant</h1>
              <p className="text-gray-600">Get personalized recommendations with advanced AI insights</p>
            </div>

            {/* Subscription Status */}
            {subscriptionInfo && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Crown className="w-5 h-5 text-purple-600" />
                    <div>
                      {subscriptionInfo.status === 'active' ? (
                        <>
                          <h3 className="font-semibold text-purple-900">Premium Active</h3>
                          <p className="text-sm text-purple-700">
                            Unlimited recommendations until {new Date(subscriptionInfo.endDate).toLocaleDateString()}
                          </p>
                        </>
                      ) : (
                        <>
                          <h3 className="font-semibold text-purple-900">Free Trial</h3>
                          <p className="text-sm text-purple-700">
                            {accessInfo?.remaining || 0} free recommendations remaining
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  {subscriptionInfo.status !== 'active' && (
                    <button
                      onClick={() => setShowSubscriptionModal(true)}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Upgrade
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Subscription Required Message */}
            {subscriptionRequired && (
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-6 text-center">
                <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-red-900 mb-2">Subscription Required</h3>
                <p className="text-red-700 mb-4">
                  You've used all your free recommendations. Subscribe to get unlimited outfit suggestions!
                </p>
                <button
                  onClick={() => setShowSubscriptionModal(true)}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
                >
                  View Subscription Plans
                </button>
              </div>
            )}

            {/* Smart Suggestion Banner */}
            {showSmartSuggestion && activeTab === 'outfits' && !subscriptionRequired && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-purple-100 rounded-full p-2">
                      <Zap className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-purple-900">Make Your Wardrobe Smarter</h3>
                      <p className="text-sm text-purple-700">
                        Some outfit matches are below 80%. Discover items that will complete your perfect looks!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleMakeItSmarter}
                    className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <span>Shop Smart</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Enhanced Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => setActiveTab('outfits')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'outfits'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Sparkles className="inline w-4 h-4 mr-2" />
                Outfit Ideas
              </button>
              <button
                onClick={() => setActiveTab('shopping')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'shopping'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <TrendingUp className="inline w-4 h-4 mr-2" />
                Smart Shopping
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'insights'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BarChart3 className="inline w-4 h-4 mr-2" />
                Style Insights
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'calendar'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar className="inline w-4 h-4 mr-2" />
                Outfit Calendar
              </button>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        {activeTab === 'outfits' && !subscriptionRequired && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/20"
          >
            <div className="flex items-center space-x-4">
              <select
                value={selectedOccasion}
                onChange={(e) => setSelectedOccasion(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white/90"
              >
                <option value="">All Occasions</option>
                {occasions.map((occasion) => (
                  <option key={occasion} value={occasion}>
                    {occasion}
                  </option>
                ))}
              </select>
              
              <button
                onClick={fetchRecommendations}
                disabled={isLoading}
                className="btn-primary"
              >
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Content */}
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/20"
          >
            <div className="flex justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Generating personalized recommendations...</p>
              </div>
            </div>
          </motion.div>
        ) : subscriptionRequired ? null : activeTab === 'outfits' ? (
          // Outfit Recommendations with Model Visualization
          recommendations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/20 text-center"
            >
              <Sparkles className="h-16 w-16 text-primary-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Recommendations Available</h3>
              <p className="text-gray-600">
                Try adding more items to your wardrobe or selecting a different occasion.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-8">
              {/* Model Visualization for Selected Outfit */}
              {recommendations.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/20 virtual-model-preview"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <User className="w-6 h-6 text-purple-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Realistic 3D Model Preview</h3>
                    </div>
                    
                    {/* Enhanced Controls */}
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Outfit:</span>
                      <select
                        value={selectedOutfitForModel}
                        onChange={(e) => setSelectedOutfitForModel(parseInt(e.target.value))}
                        className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/90"
                      >
                        {recommendations.map((rec, index) => (
                          <option key={rec.id} value={index}>
                            {rec.occasion} Outfit {index + 1}
                          </option>
                        ))}
                      </select>
                      
                      <SocialSharing
                        outfitData={{
                          id: recommendations[selectedOutfitForModel].id,
                          items: getOutfitItems(recommendations[selectedOutfitForModel]),
                          occasion: recommendations[selectedOutfitForModel].occasion
                        }}
                        userProfile={user}
                      />
                    </div>
                  </div>

                  {/* Realistic Avatar Component */}
                  <RealisticAvatar
                    userProfile={{
                      skinTone: user?.skinTone,
                      bodyType: user?.bodyType,
                      preferredStyle: user?.preferredStyle,
                      gender: 'unisex' // You can make this dynamic if you have gender in user profile
                    }}
                    outfitItems={getOutfitItems(recommendations[selectedOutfitForModel])}
                    outfitData={{
                      occasion: recommendations[selectedOutfitForModel].occasion,
                      confidence: recommendations[selectedOutfitForModel].confidence,
                      description: recommendations[selectedOutfitForModel].description,
                      styleNotes: recommendations[selectedOutfitForModel].styleNotes,
                      missingItems: recommendations[selectedOutfitForModel].missingItems
                    }}
                    className="h-full"
                  />
                </motion.div>
              )}

              {/* All Outfit Recommendations */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/20"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Outfit Recommendations</h3>
                  <span className="text-sm text-gray-600">{recommendations.length} outfits</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {recommendations.map((recommendation, index) => (
                    <motion.div
                      key={recommendation.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer transition-all border-2 ${
                        selectedOutfitForModel === index ? 'border-purple-500 shadow-xl' : 'border-gray-200 hover:shadow-xl hover:border-purple-300'
                      }`}
                      onClick={() => setSelectedOutfitForModel(index)}
                    >
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {recommendation.occasion} Outfit {index + 1}
                          </h3>
                          <div className="flex items-center space-x-2">
                            <Sparkles className="h-4 w-4 text-yellow-500" />
                            <span className={`text-sm font-medium ${getConfidenceColor(recommendation.confidence)}`}>
                              {Math.round(recommendation.confidence * 100)}% - {getConfidenceLabel(recommendation.confidence)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Low Confidence Warning */}
                        {recommendation.confidence < 0.8 && (
                          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <Zap className="w-4 h-4 text-yellow-600" />
                              <span className="text-sm text-yellow-800">
                                This outfit could be improved with additional items
                              </span>
                            </div>
                          </div>
                        )}
                        
                        <p className="text-gray-600 mb-4">{recommendation.description}</p>
                        
                        {recommendation.styleNotes && (
                          <p className="text-sm text-gray-500 mb-4 italic">{recommendation.styleNotes}</p>
                        )}
                        
                        {/* Outfit Items */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          {recommendation.items.map((itemId) => {
                            const item = items.find(i => i.id === itemId);
                            return item ? (
                              <div key={itemId} className="text-center">
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-24 object-cover rounded-lg mb-2"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = 'https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=400';
                                  }}
                                />
                                <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
                                <p className="text-xs text-gray-600">{item.category} • {item.color}</p>
                              </div>
                            ) : null;
                          })}
                        </div>

                        {/* Missing Items with Marketplace Products */}
                        {recommendation.missingItems && recommendation.missingItems.length > 0 && (
                          <div className="border-t pt-4">
                            <h5 className="font-medium text-gray-900 mb-3">Complete the look:</h5>
                            <div className="space-y-3">
                              {recommendation.missingItems.map((missingItem, missingIndex) => (
                                <div key={missingIndex} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-900">
                                      {missingItem.description}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(missingItem.priority)}`}>
                                      {missingItem.priority}
                                    </span>
                                  </div>
                                  
                                  {missingItem.availableProducts && missingItem.availableProducts.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2">
                                      {missingItem.availableProducts.slice(0, 3).map((product) => (
                                        <a
                                          key={product.id}
                                          href={product.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="block group"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <div className="relative">
                                            <img
                                              src={product.imageUrl}
                                              alt={product.name}
                                              className="w-full h-12 object-cover rounded group-hover:opacity-80 transition-opacity"
                                              onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.src = 'https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=400';
                                              }}
                                            />
                                            <div className="absolute top-0 right-0 p-1 bg-white/80 rounded-bl">
                                              <ExternalLink className="w-2 h-2 text-gray-500" />
                                            </div>
                                          </div>
                                          <p className="text-xs text-gray-600 mt-1 truncate">{product.name}</p>
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium">${product.price}</span>
                                            <span className="text-xs text-gray-500">{product.source}</span>
                                          </div>
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                  
                                  <div className="mt-2 flex justify-end">
                                    <a
                                      href="/marketplace"
                                      className="flex items-center text-xs text-purple-600 hover:text-purple-800 transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ShoppingBag className="w-3 h-3 mr-1" />
                                      <span>Shop similar items</span>
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Enhanced Action Buttons */}
                        <div className="flex space-x-2 mt-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOutfitForModel(index);
                              document.querySelector('.virtual-model-preview')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            <User size={16} />
                            <span>View on Model</span>
                          </button>
                          
                          <SocialSharing
                            outfitData={{
                              id: recommendation.id,
                              items: getOutfitItems(recommendation),
                              occasion: recommendation.occasion
                            }}
                            userProfile={user}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          )
        ) : activeTab === 'insights' ? (
          // Style Insights
          <StyleInsights
            wardrobeItems={items}
            userProfile={user}
            recommendations={recommendations}
          />
        ) : activeTab === 'calendar' ? (
          // Outfit Calendar
          <OutfitCalendar
            wardrobeItems={items}
            onPlanOutfit={handlePlanOutfit}
          />
        ) : (
          // Smart Shopping List
          shoppingList.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/20 text-center"
            >
              <TrendingUp className="h-16 w-16 text-primary-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Shopping Suggestions</h3>
              <p className="text-gray-600">
                Your wardrobe looks complete! Check back later for new suggestions.
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/20"
            >
              <div className="space-y-6">
                {shoppingList.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-lg shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow border border-gray-200"
                    onClick={() => handleShoppingItemClick(item)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{item.item}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(item.priority)}`}>
                            {item.priority} priority
                          </span>
                        </div>
                        <p className="text-gray-600 mb-2">{item.reason}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Category: {item.category}</span>
                          <span>Budget: ${item.priceRange.min} - ${item.priceRange.max}</span>
                          <span>Occasions: {item.occasions.join(', ')}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                    
                    {/* Available Products */}
                    {item.availableProducts && item.availableProducts.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Available Options:</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                          {item.availableProducts.map((product) => (
                            <a
                              key={product.id}
                              href={product.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block group bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-32 object-cover rounded mb-2 group-hover:opacity-80 transition-opacity"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=400';
                                }}
                              />
                              <h5 className="text-sm font-medium text-gray-900 truncate mb-1">{product.name}</h5>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-primary-600">${product.price}</span>
                                {product.rating && (
                                  <div className="flex items-center">
                                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                    <span className="text-xs text-gray-600 ml-1">{product.rating.toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">{product.source}</span>
                                <ExternalLink className="w-3 h-3 text-gray-400" />
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )
        )}

        {/* Subscription Modal */}
        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          onSuccess={handleSubscriptionSuccess}
        />
      </div>
    </div>
  );
};

export default RecommendationsPage;