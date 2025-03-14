import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import InteractionActivity from "./Interaction/InteractionActivity"
import VideoCalling from "./videocalling/VideoCalling"
import AdminSigninPage from './AdminSign/AdminSigninPage';
import AdminSignupPage from './AdminSign/AdminSignupPage';
import AdminDashboardPage from './AdminDashboard/AdminDashboardPage';
import VideoCallingAdmin from './VideoCallingAdmin/VideoCallingAdmin';
import FileUpload from './AdminDashboard/FileUpload';


function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<InteractionActivity />} />
        <Route path="/video-calling" element={<VideoCalling />} />
        <Route path="/signin" element={<AdminSigninPage />} />
        <Route path ="/signup" element={<AdminSignupPage />} />
        <Route path="/AdminDashboardPage" element={<AdminDashboardPage />} />
        <Route path="/video-calling-admin/:roomID" element={<VideoCallingAdmin />} />
         <Route path="/FileUpload" element = {<FileUpload />} />
      </Routes>
    </Router>
  )
}

export default App
