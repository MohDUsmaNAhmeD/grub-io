function storeName() {
    var name = document.getElementById("nameInput").value;
    var name = document.getElementById("nameInput").value.trim();
let input = document.getElementById("playerName")
const name = document.getElementById("input").value;

if (name === '') {
    alert("Please enter your name first.");
} else {
    // Store the name in localStorage for later use
    localStorage.setItem("playerName", name);
    // Redirect to index.html or any other page
    window.location.href = "/index.html";
}
}
