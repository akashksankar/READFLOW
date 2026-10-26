import React, { Suspense, lazy } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { LayoutGroup } from 'motion/react';
import { LibraryPage } from '../features/library/LibraryPage';
import { NavigationShell, type TopLevelSection } from '../features/nav/NavigationShell';
import { PaperGrain } from '../ui/PaperGrain';

const ReaderPage = lazy(() =>
  import('../features/reader/ReaderPage').then((m) => ({ default: m.ReaderPage }))
);

const NotebookPage = lazy(() =>
  import('../features/notes/NotebookPage').then((m) => ({ default: m.NotebookPage }))
);

const TodayPage = lazy(() =>
  import('../features/today/TodayPage').then((m) => ({ default: m.TodayPage }))
);

const DeckList = lazy(() =>
  import('../features/cards/DeckList').then((m) => ({ default: m.DeckList }))
);

const StudyView = lazy(() =>
  import('../features/cards/StudyView').then((m) => ({ default: m.StudyView }))
);

export function AppRoutes() {
  const [location, setLocation] = useLocation();
  const isReaderRoute = location.startsWith('/read/');
  const isNotesRoute = location.startsWith('/notes/');
  const isStudyRoute = location.includes('/study');
  const showNavShell = !isReaderRoute && !isNotesRoute && !isStudyRoute;

  const activeSection: TopLevelSection = location.startsWith('/today')
    ? 'today'
    : location.startsWith('/cards')
    ? 'cards'
    : 'library';

  const handleSelectSection = (sec: TopLevelSection) => {
    if (sec === 'library') setLocation('/');
    else if (sec === 'today') setLocation('/today');
    else if (sec === 'cards') setLocation('/cards');
  };

  const routeSwitch = (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-bg text-sm text-ink-3">
          Opening…
        </div>
      }
    >
      <Switch>
        <Route path="/" component={LibraryPage} />
        <Route path="/today">
          <TodayPage
            onOpenDocument={(docId) => setLocation(`/read/${docId}`)}
            onNavigateCards={() => setLocation('/cards')}
          />
        </Route>
        <Route path="/cards">
          <DeckList
            onStartStudy={(deckId) =>
              setLocation(`/cards/${encodeURIComponent(deckId)}/study`)
            }
            onOpenDocumentPage={(docId, pageNumber) =>
              setLocation(`/read/${docId}?pulsePage=${Math.max(0, pageNumber - 1)}`)
            }
          />
        </Route>
        <Route path="/cards/:deckId/study">
          {(params) => (
            <StudyView
              deckId={decodeURIComponent(params.deckId)}
              onBack={() => setLocation('/cards')}
              onOpenDocumentPage={(docId, pageNumber) =>
                setLocation(`/read/${docId}?pulsePage=${Math.max(0, pageNumber - 1)}`)
              }
            />
          )}
        </Route>
        <Route path="/read/:id">
          {(params) => <ReaderPage docId={params.id} />}
        </Route>
        <Route path="/notes/:id">
          {(params) => <NotebookPage docId={params.id} />}
        </Route>
        <Route>
          <LibraryPage />
        </Route>
      </Switch>
    </Suspense>
  );

  return (
    <LayoutGroup>
      <div className="relative z-10 min-h-[100dvh]">
        {showNavShell ? (
          <NavigationShell
            activeSection={activeSection}
            onSelectSection={handleSelectSection}
          >
            {routeSwitch}
          </NavigationShell>
        ) : (
          routeSwitch
        )}
      </div>
      {/* Paper grain is never rendered behind reading text */}
      {!isReaderRoute && <PaperGrain />}
    </LayoutGroup>
  );
}
