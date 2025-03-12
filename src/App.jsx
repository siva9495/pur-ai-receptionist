import InteractionActivity from "./Interaction/InteractionActivity"
import VideoCalling from "./videocalling/VideoCalling"


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
