"use client";

export default function ClosePageButton() {
    const handleClose = () => {
        try {
            window.close();
            // If window.close() doesn't work (due to browser restrictions),
            // fallback to going back in history or showing a message
            setTimeout(() => {
                if (!window.closed) {
                    // Try to go back in history
                    if (window.history.length > 1) {
                        window.history.back();
                    } else {
                        // Show alert as last resort
                        alert("You can now close this tab manually.");
                    }
                }
            }, 100);
        } catch (error) {
            console.warn("Could not close window:", error);
            alert("You can now close this tab manually.");
        }
    };

    return (
        <button 
            type="button" 
            className="button-secondary" 
            onClick={handleClose}
        >
            Close Page
        </button>
    );
}
