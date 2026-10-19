import { Layout } from 'react-admin';
import { CustomMenu } from './CustomMenu';
import { CustomAppBar } from './CustomAppBar';
import { BackToArticleEditor } from './BackToArticleEditor';

// appBarAlwaysOn is required here: react-admin's default Sidebar shifts
// itself up with a negative margin once the page scrolls past ~100px
// (via MUI's useScrollTrigger), assuming the app bar collapses/hides on
// scroll to compensate. Our CustomAppBar never hides, so without this flag
// the sidebar visibly slid up and off-screen on any page tall enough to
// scroll - the real cause of the sidebar/header "not staying pinned" bug.
export const CustomLayout = ({ children, ...props }: any) => (
  <Layout {...props} menu={CustomMenu} appBar={CustomAppBar} appBarAlwaysOn>
    <BackToArticleEditor />
    {children}
  </Layout>
);
