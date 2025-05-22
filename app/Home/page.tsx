'use client';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import Link from 'next/link';
import { db } from '../../firebaseconfig';
import { collection, getDocs, doc, getDoc, query, limit, startAfter, orderBy, where } from "firebase/firestore";
import Sidebar from '../Components/sidebar';
import styles from './home.module.css';
import cardstyles from './profileCard.module.css';
import Footer from '../Components/footer';

// CardProps interface
interface CardProps {
  userId: string;
  userType: string;
  firstName: string;
  lastName: string;
  school: string;
  description: string;
  profileImageUrl?: string;
  status?: string;
  volunteer?: boolean;
  highlightCategory?: string;
  categoryCounts?: { Game: number; App: number; Website: number; Other: number };
}

// Filters interface
interface Filters {
  searchQuery: string;
  selectedSchool: string;
  showGraduated: boolean;
  showStudents: boolean;
  showVolunteers: boolean;
  showWebsites: boolean;
  showApps: boolean;
  showGames: boolean;
}

const HomePage: React.FC = () => {
  // State
  const [featuredCards, setFeaturedCards] = useState<CardProps[]>([]);
  const [regularCards, setRegularCards] = useState<CardProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  
  // Filters state
  const [filters, setFilters] = useState<Filters>({
    searchQuery: "",
    selectedSchool: "",
    showGraduated: false,
    showStudents: false,
    showVolunteers: false,
    showWebsites: false,
    showApps: false,
    showGames: false
  });

  const PAGE_SIZE = 20;
  
  // Fetch featured cards first (they load faster)
  useEffect(() => {
    const getFeatured = async () => {
      try {
        const res = await fetch("/api/runcode");
        const data = await res.json();
        if (res.ok) {
          setFeaturedCards(data.featuredUsers);
        } else {
          console.error("API error:", data.error);
        }
      } catch (err) {
        console.error("Failed to fetch featured users:", err);
      }
      fetchUsers();  // fetch first page after featured users load
    };
  
    getFeatured();
  }, []);
  
  // Fetch regular users with pagination
  const fetchUsers = async (loadMore = false) => {
    if (loadMore && !hasMore) return;
    
    try {
      setLoadingMore(loadMore);
      if (!loadMore) setLoading(true);
      // Compose API URL with pagination param
      let url = `/api/users?limit=${PAGE_SIZE}`;
      if (loadMore && lastDoc) {
        url += `&startAfter=${lastDoc}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        console.error("API error:", data.error);
        return;
      }
      if (loadMore) {
        setRegularCards(prev => [...prev, ...data.users]);
      } else {
        setRegularCards(data.users);
      }
      setLastDoc(data.lastDoc);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  // Load more users when scrolling to bottom
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchUsers(true);
    }
  }, [loadingMore, hasMore]);

  // Filter cards based on search name and checkboxes
  const filteredCards = useMemo(() => {
    // Always prioritize featured cards first, then regular cards
    // This ensures that "Most Game", "Most App", etc. always appear first
    let allCards = [...featuredCards];
    
    // Add regular cards that aren't already in featured cards
    regularCards.forEach(regularCard => {
      if (!featuredCards.some(featuredCard => featuredCard.userId === regularCard.userId)) {
        allCards.push(regularCard);
      }
    });
    
    return allCards.filter((card) => {
      const nameMatch = `${card.firstName} ${card.lastName}`.toLowerCase().includes(filters.searchQuery.toLowerCase());
      const schoolMatch = !filters.selectedSchool.trim() || 
                         filters.selectedSchool.toLowerCase() === "any" || 
                         card.school.toLowerCase().includes(filters.selectedSchool.toLowerCase());
      const graduatedMatch = !filters.showGraduated || card.status === "Graduate";
      const volunteerMatch = !filters.showVolunteers || card.volunteer;
      const studentMatch = !filters.showStudents || card.status === "Student";
      const appsMatch = !filters.showApps || (card.categoryCounts?.App ?? 0) > 0;
      const websitesMatch = !filters.showWebsites || (card.categoryCounts?.Website ?? 0) > 0;
      const gamesMatch = !filters.showGames || (card.categoryCounts?.Game ?? 0) > 0;
      
      return nameMatch && schoolMatch && graduatedMatch && volunteerMatch && 
             studentMatch && appsMatch && websitesMatch && gamesMatch;
    });
  }, [
    featuredCards, 
    regularCards, 
    filters
  ]);

  // Handle search updates from sidebar
  const handleSearchChange = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  }, []);

  // Handle filter updates from sidebar
  const handleSchoolChange = useCallback((school: string) => {
    setFilters(prev => ({ ...prev, selectedSchool: school.trim() }));
  }, []);

  const handleGraduatedChange = useCallback((graduated: boolean) => {
    setFilters(prev => ({ ...prev, showGraduated: graduated }));
  }, []);

  const handleVolunteerChange = useCallback((volunteer: boolean) => {
    setFilters(prev => ({ ...prev, showVolunteers: volunteer }));
  }, []);

  const handleStudentChange = useCallback((student: boolean) => {
    setFilters(prev => ({ ...prev, showStudents: student }));
  }, []);

  const handleAppsChange = useCallback((apps: boolean) => {
    setFilters(prev => ({ ...prev, showApps: apps }));
  }, []);

  const handleWebsitesChange = useCallback((websites: boolean) => {
    setFilters(prev => ({ ...prev, showWebsites: websites }));
  }, []);

  const handleGamesChange = useCallback((games: boolean) => {
    setFilters(prev => ({ ...prev, showGames: games }));
  }, []);

  // Function to determine what the user has the most of
  // const getMostCategory = useCallback((categoryCounts: { Game: number; App: number; Website: number; Other: number }) => {
  //   type CategoryType = keyof typeof categoryCounts;
  //   const categories: CategoryType[] = ['Game', 'App', 'Website'];
    
  //   let mostCategory: CategoryType = 'Game';
  //   let maxCount = categoryCounts[mostCategory] || 0;

  //   categories.forEach(category => {
  //     if ((categoryCounts[category] || 0) > maxCount) {
  //       mostCategory = category;
  //       maxCount = categoryCounts[category] || 0;
  //     }
  //   });

  //   return mostCategory;
  // }, []);

  // Scroll handler for infinite loading
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >= 
        document.documentElement.offsetHeight - 500 &&
        !loadingMore && 
        hasMore
      ) {
        loadMore();
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore, loadingMore, hasMore]);

  // Card Component - Memoized to prevent unnecessary re-renders
  const CardComponent = React.memo<CardProps & { index: number }>(({ 
    userId, 
    userType, 
    firstName, 
    lastName, 
    school, 
    description, 
    profileImageUrl, 
    highlightCategory, 
    categoryCounts,
    index
  }) => {
    const truncatedDescription = description.length > 60 ? description.slice(0, 60) + '...' : description;

    const profileUrl = userType === 'student'
      ? `/StudentProfilePage?userId=${userId}`
      : `/BusinessProfilePage?userId=${userId}`;

    // Determine if this is a featured card
    const isFeatured = index < featuredCards.length;
    
    // Get category label for featured cards
    let categoryLabel = "";
    if (isFeatured && highlightCategory) {
      categoryLabel = `Most ${highlightCategory} Projects`;
    }
    
    const showCategoryBar = isFeatured && highlightCategory;
    const cardClass = isFeatured ? `${cardstyles.card} ${cardstyles.highlightedCard}` : cardstyles.card;

    return (
      <Link className={cardstyles.cardLink} href={profileUrl}>
        <div className={cardClass}>
          {showCategoryBar && categoryLabel && <div className={cardstyles.categoryBar}>{categoryLabel}</div>}          
          <div className={cardstyles.cardBody}>
            <div className={cardstyles.profileImageContainer}>
              {profileImageUrl ? (
                <img 
                  src={profileImageUrl} 
                  alt="Profile" 
                  className={cardstyles.profileImage}
                  loading="lazy" // Lazy load images
                />
              ) : (
                <span className={cardstyles.initials}>{firstName[0]}{lastName[0]}</span>
              )}
            </div>
            <h5 className={cardstyles.cardTitle}>{firstName} {lastName}</h5>
            <h6 className={cardstyles.cardSubtitle}>{school}</h6>
            <p className={cardstyles.cardText}>{truncatedDescription}</p>
          </div>
        </div>
      </Link>
    );
  });
  
  CardComponent.displayName = 'CardComponent';

  // Home page layout
  return (
    <div className={styles.container}>
      <div className="row">
        <div className={`col-md-auto ${styles.columnleft}`}>
          <Sidebar
            onNameSearchChange={handleSearchChange}
            onSchoolChange={handleSchoolChange}
            onGraduatedChange={handleGraduatedChange}
            onVolunteerChange={handleVolunteerChange}
            onStudentChange={handleStudentChange}
            onAppsChange={handleAppsChange}
            onWebsitesChange={handleWebsitesChange}
            onGamesChange={handleGamesChange}
          />
        </div>
        <div className="col">
          <div className={styles.scrollableContainer}>
            {loading ? (
              <div className={styles.loadingContainer}>
                <DotLottieReact
                  src="./loading_BlueComputer.json"
                  loop
                  autoplay
                />
              </div>
            ) : (
              <>
                <div className={styles.cardContainer}>
                  {filteredCards.map((card, index) => (
                    <CardComponent key={card.userId} index={index} {...card} />
                  ))}
                  
                  {filteredCards.length === 0 && (
                    <div className={styles.noResults}>
                      <h3>No users match your filters</h3>
                      <p>Try adjusting your search criteria</p>
                    </div>
                  )}
                </div>
                
                {loadingMore && (
                  <div className={styles.loadMoreIndicator}>
                    <DotLottieReact
                      src="./loading_BlueComputer.json"
                      loop
                      autoplay
                      style={{ width: '100px', height: '100px' }}
                    />
                  </div>
                )}
              </>
            )}
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;