import { Routes, Route } from 'react-router-dom';
import { BuilderPage } from './builder-page.js';
import styles from './app.module.css';

/**
 * Root of the MyPlayer Builder app.
 *
 * @returns the app routes.
 */
export function MyplayerBuilder() {
  return (
    <div className={styles.app}>
      <Routes>
        <Route path="/" element={<BuilderPage />} />
      </Routes>
    </div>
  );
}
