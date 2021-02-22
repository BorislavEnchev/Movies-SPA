import { showInfo, showError, beginRequest, endRequest } from './notifications.js';
const db = firebase.firestore();

const app = Sammy('#container', function() {

    this.use('Handlebars', 'hbs'); 
    Handlebars.registerHelper('buyTicket', function(event) {
        console.log(event.target)
    });
    const movies = [];

    // GET
    this.get('/home', function() {
        extendContext(this)
        .then(function() {
            this.partial('./templates/home.hbs');            
        });
    });

    this.get('/login', function() {
        extendContext(this)
        .then(function() {
            this.partial('./templates/user/login.hbs');
        });
    });

    this.get('/register', function() {
        extendContext(this)
        .then(function() {
            this.partial('./templates/user/register.hbs');
        });
    });

    this.get('/logout', function() {
        firebase.auth().signOut()
        .then(data => {
            clearUserData();
            this.redirect('#/home');            
        }).then(function () {
            showInfo('Logout successful.');
        })
        .catch(err => {
            showError(err);
        });
    });

    this.get('/cinema', function() {
        beginRequest();

        db.collection('movies')
        .get()
        .then(response => {
            response.docs.map((movie) => { 
                movies.push({ id: movie.id, ...movie.data()});
                // return { id: movie.id, ...movie.data()};
                this.movies = movies;
            });            
        })
        .then(response => {
            extendContext(this)
            .then(function() {
                this.loadPartials({ movie: './templates/movies/movie.hbs' });
                
                this.partial('./templates/movies/cinema.hbs');
                console.log(movies);
                endRequest();
            });            
        })
        .catch(showError);
    });

    this.get('/addMovie', function() {
        extendContext(this)
        .then(function() {
            this.partial('./templates/movies/create.hbs');
        });
    });

    this.get('/myMovies', function() {
        beginRequest();

        db.collection('movies')
        .where('author', '==', getUserData().email)
        .get()
        .then(response => {
            this.myMovies = response.docs.map((myMovie) => { return { id: myMovie.id, ...myMovie.data()}});
        })
        .then(response => {
            extendContext(this)
            .then(function() {
                this.loadPartials({ myMovie: './templates/movies/myMovie.hbs' });
                this.partial('./templates/movies/myMovies.hbs');

                endRequest();
            });
        })
        .catch(err => {
            alert(err);
        });        
    });

    this.get('/details/:id', function() {
        let { id } = this.params;
        beginRequest();

        db.collection('movies')
        .doc(id)
        .get()
        .then(movie => {
            let movieData = movie.data();
            this.movie = {id, ...movieData};
        })
        .then(response => {
            extendContext(this)
            .then(function() {
                this.partial('./templates/movies/details.hbs');
                endRequest();
            });
        })
        .catch(showError);        
    });

    this.get('/edit/:id', function() {
        let { id } = this.params;
        beginRequest();

        db.collection('movies').doc(id).get()
        .then(movie => {
            let movieData = movie.data();
            this.movie = {id, ...movieData};
            extendContext(this)
            .then(function() {
                this.partial('./templates/movies/edit.hbs');

                endRequest();
            });            
        }).catch(showError);
    });

    this.get('/delete/:id', function() {
        let { id } = this.params;
        beginRequest();

        db.collection('movies').doc(id).get()
        .then(movie => {
            let movieData = movie.data();
            this.movie = {id, ...movieData};
            extendContext(this)
            .then(function() {
                this.partial('./templates/movies/delete.hbs');

                endRequest();
            });            
        }).catch(showError);
    });

    this.get('/buy/:id', function() {
        //TODO: buy tickets
    })

    //search for movies (path made to match the requirements if the task)
    this.get('/movie/all', function() {
        let { search } = this.params;
        
        beginRequest();

        db.collection('movies')       
        .where('genres', 'array-contains', search) 
        .get()
        .then(response => {
            this.movies = response.docs.map((movie) => { return { id: movie.id, ...movie.data()}});
        })
        .then(response => {
            extendContext(this)
            .then(function() {
                this.loadPartials({ movie: './templates/movies/movie.hbs' });
                
                this.partial('./templates/movies/cinema.hbs');

                endRequest();
            });            
        })
        .catch(showError);
    });

    // POST
    this.post('/register', function() {
        let { email, password, repeatPassword } = this.params;

        if (!email || !password || !repeatPassword) {
            showError("Error: Invalit credentials. Please retry your request with correct credentials");
        } 
        else if (password != repeatPassword) {
            showError("Passwords does not match!");
        } 
        else {
            startRequest();

            firebase.auth().createUserWithEmailAndPassword(email, password)
            .then(function () {
                firebase.auth().signInWithEmailAndPassword(email, password);
            })
            .then(userData => {
                setUserData(userData);

                endRequest();
                showInfo('User registration successful.');
                this.redirect('#/home');
            })
            .catch(showError);
        }
    });

    this.post('/login', function() {
        let { email, password } = this.params;

        beginRequest();

        firebase.auth().signInWithEmailAndPassword(email, password)
        .then(userData => {
            setUserData(userData);

            endRequest();
            showInfo('Logged in successfully.');
            this.redirect('#/home');
        })
        .catch(err => {
            alert(err);
        });
    }); 

    this.post('/addMovie', function() {
        let { title, imageUrl, description, genres, tickets } = this.params;

        if (!title || !imageUrl || !description || !genres || !tickets) {
            showError('Please provide all the information');
        } 
        else if (title.length < 6) {
            showError('Title must be at least 6 characters');
        }
        else if (!isValidHttpUrl(imageUrl)) {
            showError('Image URL is invalid');
        }
        else {
            let movie = { 
                title,
                imageUrl,
                description,
                genres: Array.from(genres.split(' ')),
                tickets: Number(tickets),
                author: getUserData().email
            };
            beginRequest();

            db.collection('movies')
            .add(movie)
            .then(res => {
                endRequest();
                showInfo('Movie created successfully');
                this.redirect('#/home')
            })
            .catch(showError);
        }
    });

    this.post('/edit/:id', function() {
        let { id, title, imageUrl, description, genres, tickets } = this.params;

        if (!id || !title || !imageUrl || !description || !genres || !tickets) {
            showError('Provide full information of the movie');
        } else {
            let movie = { 
                title,
                imageUrl,
                description,
                genres: Array.from(genres.split(',')),
                tickets: Number(tickets),
            };
            db.collection('movies')
            .doc(id)
            .update(movie)
            .then(response => {
                showInfo('Movie edited successfully.')
                this.redirect(`#/details/${id}`);
            })
            .catch(showError);
        }
    });

    this.post('/delete/:id', function() {
        let { id } = this.params;

        beginRequest();

        db.collection('movies')
        .doc(id)
        .delete()
        .then(response => {
            endRequest();
            showInfo('Movie removed successfully!');
            this.redirect(`#/home`);
        })
        .catch(showError);
    });
});

(() => {
    app.run('#/home');
})();

function extendContext(context) {
    const user = getUserData();
    context.isLoggedIn = Boolean(user);
    context.email = user ? user.email : '';

    return context.loadPartials({
        header: './templates/common/header.hbs',
        footer: './templates/common/footer.hbs'
    });
}

function getUserData() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function setUserData (data) {
    let { user: {email, uid} } = data;
    localStorage.setItem('user', JSON.stringify({ email, uid }));
}

function clearUserData () {
    localStorage.removeItem('user');
}

function isValidHttpUrl(string) {
    let url;
    
    try {
      url = new URL(string);
    } catch (_) {
      return false;  
    }
  
    return url.protocol === "http:" || url.protocol === "https:";
}

function buyTicket(event) {
    console.log(event.target)
}